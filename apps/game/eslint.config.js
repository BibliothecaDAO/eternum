import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const NO_MUTATING_SORT = {
  selector: "CallExpression[callee.property.name='sort']",
  message: "Use .toSorted() instead of .sort() to avoid array mutation. See issue #4076.",
};

// A colour written into a shell component is a second palette; the shell's colours come from src/tokens.ts.
const COLOUR_LITERAL = "/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])|rgba?\\(/";
const COLOUR_MESSAGE =
  "Shell colours come from the token file (src/tokens.ts): use a kit-* class or theme(colors.kit.*).";

// A shell file never writes a time, an amount, a failure or a fallback name itself: each has one owner.
const OWNED_FORMATS = [
  {
    selector:
      "MemberExpression[property.name=/^toLocale(Date|Time)?String$/], NewExpression[callee.object.name='Intl']",
    message: "Times come from ClockChip and the kit's time.ts, amounts from the kit's amount.ts.",
  },
  {
    selector: "Literal[value=/^(Lord |Unnamed|Player-)/], TemplateElement[value.raw=/^(Lord |Unnamed|Player-)/]",
    message: "A player's name comes from PlayerName (the one name rule).",
  },
  {
    selector: "Literal[value=/did not answer|unavailable right now/]",
    message: "A failed read is worded by ServiceFailure, one line per service.",
  },
];

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-syntax": ["error", NO_MUTATING_SORT],
    },
  },
  {
    files: ["src/shell/**/*.{ts,tsx}"],
    // Tests assert the owners' own words.
    ignores: ["src/shell/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_MUTATING_SORT,
        { selector: `Literal[value=${COLOUR_LITERAL}]`, message: COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=${COLOUR_LITERAL}]`, message: COLOUR_MESSAGE },
        ...OWNED_FORMATS,
      ],
    },
  },
  {
    // The failure owner is the one file that words a failure.
    files: ["src/shell/service-failure.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_MUTATING_SORT,
        { selector: `Literal[value=${COLOUR_LITERAL}]`, message: COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=${COLOUR_LITERAL}]`, message: COLOUR_MESSAGE },
        ...OWNED_FORMATS.slice(0, 2),
      ],
    },
  },
  {
    ignores: ["**/src/assets/**"],
  },
);
