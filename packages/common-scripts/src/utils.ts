import { readFile, writeFile, readdir, unlink, rename } from "fs/promises";
import { resolve } from "path";
import { cwd } from "process";
import { PackageJson } from "type-fest";

export const getPackages = async () => {
  const exceptPackages = ["vite-react-example", "trong-doc"];
  const packagesPath = resolve(cwd(), "..");

  return (await readdir(resolve(packagesPath), { withFileTypes: true }))
    .filter((w) => w.isDirectory() && !exceptPackages.includes(w.name))
    .map((w) => ({
      name: `@trong-orm/${w.name}`,
      dir: `${packagesPath}/${w.name}`,
    }));
};

export const updateJson = async (
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
