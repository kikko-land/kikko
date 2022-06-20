const rootDir = process.cwd().includes("packages/react-queries-hooks")
  ? "./"
  : "./packages/react-queries-hooks";

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
