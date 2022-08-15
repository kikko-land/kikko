const rootDir = process.cwd().includes("packages/trong-doc")
  ? "./"
  : "./packages/trong-doc";

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
