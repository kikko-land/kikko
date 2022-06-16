const rootDir = process.cwd().includes("packages/vite-react-example")
  ? "./"
  : "./packages/vite-react-example";

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
