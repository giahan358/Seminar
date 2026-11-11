import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**"],
  },
  eslint.configs.recommended,
  // Script browser chạy bằng Node và có callback đánh giá trong trang, khai báo cả hai bộ global để lint đúng ngữ cảnh
  { files: ["scripts/**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
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
