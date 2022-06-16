const rootDir = process.cwd().includes("packages/react-queries-hooks")
  ? "./"
  : "./packages/react-queries-hooks";

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
