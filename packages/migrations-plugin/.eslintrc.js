const rootDir = process.cwd().includes("packages/migrations-plugin")
  ? "./"
  : "./packages/migrations-plugin";

module.exports = {
  extends: ["../common-scripts/eslintrc"],
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
