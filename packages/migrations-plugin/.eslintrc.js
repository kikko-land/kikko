const rootDir = process.cwd().includes("packages/migrations-plugin")
  ? "./"
  : "./packages/migrations-plugin";

module.exports = {
  extends: ["@trong-orm/eslint-config-trong"],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
    tsconfigRootDir: rootDir,
    project: "./tsconfig.json",
  },
};
