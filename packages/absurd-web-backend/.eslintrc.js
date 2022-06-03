const rootDir = process.cwd().includes("packages/absurd-web-backend")
  ? "./"
  : "./packages/absurd-web-backend";

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "prettier",
    "react-app",
    "eslint:recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:rxjs/recommended",
    "plugin:promise/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
    tsconfigRootDir: rootDir,
    project: "./tsconfig.json",
  },
  plugins: ["jsx-a11y", "rxjs", "simple-import-sort", "promise"],
  rules: {
    "simple-import-sort/imports": "warn",
    "simple-import-sort/exports": "warn",
  },
};
