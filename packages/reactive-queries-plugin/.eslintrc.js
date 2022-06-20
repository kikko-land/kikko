const rootDir = process.cwd().includes("packages/reactive-queries-plugin")
  ? "./"
  : "./packages/reactive-queries-plugin";

module.exports = {
  extends: ["../common-scripts/eslintrc.cjs"],
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
