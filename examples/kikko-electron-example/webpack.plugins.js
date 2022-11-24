const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const relocateLoader = require("@vercel/webpack-asset-relocator-loader");

module.exports = [
  new ForkTsCheckerWebpackPlugin(),
  {
    apply(compiler) {
      compiler.hooks.compilation.tap(
        "webpack-asset-relocator-loader",
        (compilation) => {
          relocateLoader.initAssetCache(compilation, "native_modules");
        }
      );
    },
  },
];
