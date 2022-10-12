module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    // "airbnb",
    // "airbnb-typescript",
    "plugin:jsx-a11y/recommended",
    "plugin:promise/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react-hooks/recommended",
    "plugin:prettier/recommended",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["jsx-a11y", "simple-import-sort", "promise"],
  rules: {
    "simple-import-sort/imports": "warn",
    "simple-import-sort/exports": "warn",
    "@typescript-eslint/no-floating-promises": ["warn"],
    "import/prefer-default-export": "off",
    "no-console": "off",
    "no-bitwise": "off",
    "import/extensions": "off",
    "no-use-before-define": "off",
    "no-await-in-loop": "off",
    "import/no-unresolved": "off",
    "class-methods-use-this": "off",
    "no-restricted-syntax": "off",
  },
};
