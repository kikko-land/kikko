import { spawn } from "child_process";
import path from "path";
import { readFile, writeFile, readdir } from "fs/promises";
import { resolve } from "path";
import { cwd } from "process";
import { PackageJson } from "type-fest";
import { unlink, rename } from "fs/promises";
import { existsSync } from "fs";

const runCommand = async (
  cwd: string,
  command: string,
  args: string[],
  beforeRun?: () => Promise<void>,
  afterRun?: () => Promise<void>
) => {
  console.log(
    `\nRunning "${command} ${args.join(" ")}" for ${path.basename(cwd)}:`
  );
  if (beforeRun) {
    await beforeRun();
  }

  try {
    await new Promise<void>((resolve) => {
      spawn(command, args, { cwd, stdio: "inherit" }).on("exit", async function(
        error
      ) {
        if (error) {
          if (afterRun) {
            await afterRun();
          }

          console.log(`Failed to run ${command} at ${cwd}`);
          process.exit(1);
        }

        resolve();
      });
    });
  } finally {
    if (afterRun) {
      await afterRun();
    }
  }
};

const getPackages = async () => {
  const exceptPackages = ["vite-react-example", "trong-doc"];
  const packagesPath = resolve(cwd(), "..");

  return (await readdir(resolve(packagesPath), { withFileTypes: true }))
    .filter((w) => w.isDirectory() && !exceptPackages.includes(w.name))
    .map((w) => ({
      name: `@trong-orm/${w.name}`,
      dir: `${packagesPath}/${w.name}`,
    }));
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

const run = async () => {
  const packages = await getPackages();

  runCommand(
    resolve(cwd(), "..", ".."),
    "yarn",
    ["changeset", "publish"],
    async () => {
      packages.map(async ({ dir }) => {
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
      });
    },
    async () => {
      packages.map(async ({ dir }) => {
        if (!existsSync(dir + "/package.json.backup")) return;
        await unlink(dir + "/package.json");
        await rename(dir + "/package.json.backup", dir + "/package.json");
      });
    }
  );
};

run();
