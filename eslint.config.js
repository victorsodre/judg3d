import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/client-dist/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Projeto explicito em vez de projectService: os testes vivem em
        // tsconfig.test.json, que nao e o tsconfig.json mais proximo deles.
        project: [
          "./tsconfig.test.json",
          "./packages/core/tsconfig.json",
          "./packages/judge/tsconfig.json",
          "./packages/cli/tsconfig.json",
          "./packages/mcp/tsconfig.json",
          "./packages/app/tsconfig.json",
          "./packages/app/tsconfig.ui.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  {
    files: ["packages/app/ui/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Scripts de fixtures: JS puro rodando no Node, sem analise de tipos.
    files: ["**/*.mjs", "**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
