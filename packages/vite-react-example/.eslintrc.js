const rootDir = process.cwd().includes("packages/vite-react-example")
  ? "./"
  : "./packages/vite-react-example";

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
