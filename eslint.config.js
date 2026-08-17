import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules"] },
  {
    ...js.configs.recommended,
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Express error middleware must keep its four-argument shape even when the
      // last one is unused, so an underscore marks the intent.
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
