const rootDir = process
  .cwd()
  .includes("packages/electron-better-sqlite3-backend")
  ? "./"
  : "./packages/electron-better-sqlite3-backend";

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
