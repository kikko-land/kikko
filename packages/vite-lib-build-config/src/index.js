const path = require("path");
const { defineConfig } = require("vite");
const autoExternal = require("rollup-plugin-auto-external");

exports.buildConfig = function (external = []) {
  return defineConfig({
    build: {
      sourcemap: true,
      lib: {
        entry: path.resolve("./", "src/index.ts"),
        name: "core",
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        output: {
          inlineDynamicImports: true,
        },
        plugins: [autoExternal()],
        external: external || [],
      },
    },
  });
};
