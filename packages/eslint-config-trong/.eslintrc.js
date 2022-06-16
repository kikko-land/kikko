module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "react-app",
    "prettier",
    "eslint:recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:rxjs/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:promise/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["jsx-a11y", "rxjs", "simple-import-sort", "promise"],
  rules: {
    "simple-import-sort/imports": "warn",
    "simple-import-sort/exports": "warn",
  },
};
