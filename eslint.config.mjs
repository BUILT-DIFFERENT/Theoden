import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import prettier from "eslint-config-prettier";

const tsconfigRootDir = process.cwd();

const tsRules = {
  ...tsPlugin.configs.recommended.rules,
  ...(tsPlugin.configs["recommended-type-checked"]?.rules ?? {}),
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_"
    }
  ],
  "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports"
    }
  ]
};

const reactRules = {
  ...react.configs.recommended.rules,
  ...reactHooks.configs.recommended.rules,
  ...(reactRefresh.configs.recommended?.rules ?? {}),
  ...jsxA11y.configs.recommended.rules,
  "react/react-in-jsx-scope": "off",
  "react/prop-types": "off",
  "react/jsx-uses-react": "off",
  "react/self-closing-comp": "error",
  "react/jsx-no-target-blank": "error",
  "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }]
};

const importRules = {
  "import/no-duplicates": "error",
  "import/no-unresolved": "error",
  "import/order": [
    "error",
    {
      groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
      "newlines-between": "always",
      alphabetize: { order: "asc", caseInsensitive: true },
      pathGroups: [
        {
          pattern: "@/**",
          group: "internal",
          position: "after"
        }
      ],
      pathGroupsExcludedImportTypes: ["builtin"]
    }
  ],
  "no-console": ["warn", { allow: ["warn", "error"] }]
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.next/**",
      "src-tauri/target/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        },
        project: ["./tsconfig.json"],
        tsconfigRootDir
      },
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json"
        }
      }
    },
    rules: {
      ...tsRules,
      ...importRules
    }
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      ...reactRules
    }
  },
  prettier
];
