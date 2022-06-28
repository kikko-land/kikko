const { buildConfig } = require("@trong-orm/common-scripts/vite.cjs");

module.exports = buildConfig({
  ...(() => {
    if (process.env.TO_BUILD === "index") {
      return {
        entry: "src/index.ts",
        fileName: (format) => `index.${format}.js`,
      };
    } else if (process.env.TO_BUILD === "preload") {
      return {
        entry: "src/preload.ts",
        fileName: (format) => `preload.${format}.js`,
      };
    } else {
      throw new Error("env TO_BUILD not set");
    }
  })(),
  external: ["electron"],
});
