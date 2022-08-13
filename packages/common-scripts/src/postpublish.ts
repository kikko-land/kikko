import { unlink, rename } from "fs/promises";
import { existsSync } from "fs";
import { getPackages } from "./utils.js";

const run = async () => {
  const packages = await getPackages();

  packages.map(async ({ dir }) => {
    if (!existsSync(dir + "/package.json.backup")) return;
    await unlink(dir + "/package.json");
    await rename(dir + "/package.json.backup", dir + "/package.json");
  });
};

run();
