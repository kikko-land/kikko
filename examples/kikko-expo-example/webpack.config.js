const createExpoWebpackConfigAsync = require("@expo/webpack-config");
const path = require("path");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.module.rules.forEach((rule) => {
    (rule.oneOf || []).forEach((oneOf) => {
      if (oneOf.loader && oneOf.loader.indexOf("file-loader") >= 0) {
        oneOf.exclude.push(/\.wasm$/);
      }
    });
  });

  config.module.rules.push({
    test: /\.wasm$/,
    loader: "file-loader",
    type: "javascript/auto",
  });

  config.devServer = {
    ...config.devServer,
    headers: {
      ...config.devServer.headers,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  };

  // Customize the config before returning it.
  return config;
};
