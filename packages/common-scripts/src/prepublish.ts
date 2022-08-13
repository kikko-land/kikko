import { getPackages, updateJson } from "./utils";

const run = async () => {
  const packages = await getPackages();

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
};

run();
