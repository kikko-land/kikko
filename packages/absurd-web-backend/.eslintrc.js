const rootDir = process.cwd().includes("packages/absurd-web-backend")
  ? "./"
  : "./packages/absurd-web-backend";

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
