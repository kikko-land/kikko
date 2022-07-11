const { buildConfig } = require("@trong-orm/common-scripts/vite.cjs");

module.exports = buildConfig({ external: ["wa-sqlite"] });
