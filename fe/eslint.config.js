import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];
