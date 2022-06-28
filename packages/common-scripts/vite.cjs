const path = require("path");
const { defineConfig } = require("vite");
const autoExternal = require("rollup-plugin-auto-external");
const dts = require("vite-plugin-dts");

exports.buildConfig = function (config) {
  config = config || {};
  config.entry = config.entry || "src/index.ts";
  config.fileName = config.fileName || ((format) => `index.${format}.js`);

  return defineConfig({
    build: {
      sourcemap: true,
      lib: {
        entry: path.resolve("./", config.entry),
        name: "core",
        fileName: config.fileName,
      },
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        output: {
          inlineDynamicImports: true,
        },
        plugins: [...(config.disableAutoExternal ? [] : [autoExternal()])],
        external: config.external || [],
      },
    },
    plugins: [dts()],
  });
};
