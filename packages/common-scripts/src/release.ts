import { readFile, writeFile, readdir, unlink, rename } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { cwd } from "process";
import { PackageJson } from "type-fest";
import { spawn } from "child_process";
import path from "path";
import inquirer from "inquirer";

const semverRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const runOnDirs = async (
  dirs: string[],
  command: string,
  args: string[],
  beforeRun?: (dir: string) => Promise<void>,
  afterRun?: (dir: string) => Promise<void>
) => {
  for (const dir of dirs) {
    console.log(
      `\nRunning "${command} ${args.join(" ")}" for ${path.basename(dir)}:`
    );
    if (beforeRun) {
      await beforeRun(dir);
    }

    try {
      await new Promise<void>((resolve) => {
        spawn(command, args, { cwd: dir, stdio: "inherit" }).on(
          "exit",
          async function (error) {
            if (error) {
              if (afterRun) {
                await afterRun(dir);
              }

              console.log(`Failed to run ${command} at ${dir}`);
              process.exit(1);
            }

            resolve();
          }
        );
      });
    } finally {
      if (afterRun) {
        await afterRun(dir);
      }
    }
  }
};

const run = async () => {
  const exceptPackages = ["common-scripts", "vite-react-example"];
  const packagesPath = resolve(cwd(), "..");
  const mainPackageJsonPath = resolve(cwd(), "../../package.json");

  const currentVersion = JSON.parse(
    (await readFile(mainPackageJsonPath)).toString()
  ).version;

  const { nextVersion } = await inquirer.prompt<{ nextVersion: string }>({
    type: "input",
    name: "nextVersion",
    message: `Next version (Current: ${currentVersion}):`,
    validate: (val: string) => {
      return val.match(semverRegex) ? true : "Not valid";
    },
  });

  const packages = (
    await readdir(resolve(packagesPath), { withFileTypes: true })
  )
    .filter((w) => w.isDirectory() && !exceptPackages.includes(w.name))
    .map((w) => ({
      name: `@trong-orm/${w.name}`,
      dir: `${packagesPath}/${w.name}`,
    }));

  const packagesToBump = new Set(packages.map(({ name }) => name));

  const mapDeps = (deps: Record<string, string>) => {
    return Object.fromEntries(
      Object.entries(deps).map(([name, version]) => [
        name,
        packagesToBump.has(name) ? "^" + nextVersion : version,
      ])
    );
  };

  const updateJson = async (
    file: string,
    cb: (arg: PackageJson) => PackageJson,
    backup = false
  ) => {
    const content = (await readFile(file)).toString();

    if (backup) {
      await writeFile(file + ".backup", content);
    }

    const packageContent = JSON.parse(content);

    await writeFile(file, JSON.stringify(cb(packageContent), undefined, 2));
  };

  for (const { dir } of packages) {
    await updateJson(`${dir}/package.json`, (content) => {
      return {
        ...content,
        version: nextVersion,
        dependencies: mapDeps(content.dependencies as Record<string, string>),
        devDependencies: mapDeps(
          content.devDependencies as Record<string, string>
        ),
      };
    });
  }

  await updateJson(mainPackageJsonPath, (content) => {
    return {
      ...content,
      version: nextVersion,
    };
  });

  await runOnDirs(
    packages.map(({ dir }) => dir),
    "yarn",
    ["check-typing"]
  );

  await runOnDirs(
    packages.map(({ dir }) => dir),
    "yarn",
    ["compile"]
  );

  await runOnDirs(
    packages.map(({ dir }) => dir),
    "yarn",
    ["publish", "--non-interactive"],
    async (dir) => {
      await updateJson(
        dir + "/package.json",
        (json) => {
          return {
            ...json,
            ...json["publishConfig"],
          };
        },
        true
      );
    },
    async (dir) => {
      if (!existsSync(dir + "/package.json.backup")) return;
      await unlink(dir + "/package.json");
      await rename(dir + "/package.json.backup", dir + "/package.json");
    }
  );
};

run();
