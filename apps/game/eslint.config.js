import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const NO_MUTATING_SORT = {
  selector: "CallExpression[callee.property.name='sort']",
  message: "Use .toSorted() instead of .sort() to avoid array mutation. See issue #4076.",
};

// The token file (src/tokens.ts) names every colour; the HUD's retired --frontier-* variables no longer exist.
const NO_RETIRED_TOKENS = {
  selector: "Literal[value=/--frontier-/], TemplateElement[value.raw=/--frontier-/]",
  message: "The --frontier-* variables are retired: use the token file's kit-* classes or theme(colors.kit.*).",
};

// A face named in a component is a second type system: the faces live in the token file (src/tokens.ts) and reach a
// component as font-display, font-ui or font-body.
const NO_NAMED_FONT = {
  selector:
    "Literal[value=/font-\\[|font-family/], TemplateElement[value.raw=/font-\\[|font-family/], Property[key.name='fontFamily']",
  message: "Faces come from the token file (src/tokens.ts): use font-display, font-ui or font-body.",
};

// The one readable type (decisions-1): no capitals, italics or added tracking, nothing under 14 px, and no gold text
// below 70% (it fails 4.5:1 on the HUD's surfaces). Use text-sm (14), text-base (16), text-lg (18) or text-xl (20),
// and text-kit-muted for quiet text.
const UNREADABLE_CLASS =
  "/(^|[\\s:!])(uppercase|italic|tracking-\\S+|text-xx?s|text-\\[(\\d|1[0-3])(\\.\\d+)?px\\]|text-gold\\/[1-6]\\d)(?=\\s|$)/";
const NO_UNREADABLE_TYPE = {
  selector: `Literal[value=${UNREADABLE_CLASS}], TemplateElement[value.raw=${UNREADABLE_CLASS}]`,
  message:
    "Readable type only: no uppercase, italic or tracking-*, nothing under 14 px (text-sm and up), no text-gold below /70 (use text-kit-muted).",
};

// The same rule for words written in capitals: a phrase is set in sentence case where it is written. A word of four
// capitals or more marks it, so acronyms ("CPU P95", "AMM") pass.
const CAPITALS_PHRASE = "/^(?=.*[A-Z]{4})[A-Z][A-Z'’]+( [A-Z0-9][A-Z0-9'’/-]*)+[.!]?$/";
const NO_CAPITALS_PHRASE = {
  selector: `Literal[value=${CAPITALS_PHRASE}], TemplateElement[value.raw=${CAPITALS_PHRASE}]`,
  message: "Readable type only: write the phrase in sentence case, not in capitals.",
};

// The surfaces set in the one readable type (the shell, Frontier and the kit it draws with) keep it; Blitz and Eternum
// in-game surfaces keep their own type, caps and sizes.
const READABLE_RULES = [NO_NAMED_FONT, NO_UNREADABLE_TYPE, NO_CAPITALS_PHRASE];

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
      "no-restricted-syntax": ["error", NO_MUTATING_SORT, NO_RETIRED_TOKENS],
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
        NO_RETIRED_TOKENS,
        ...READABLE_RULES,
        { selector: `Literal[value=${COLOUR_LITERAL}]`, message: COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=${COLOUR_LITERAL}]`, message: COLOUR_MESSAGE },
        ...OWNED_FORMATS,
      ],
    },
  },
  {
    // The match HUD and the kit it draws with take their faces from the token file only.
    files: ["src/ui/features/frontier/**/*.{ts,tsx}", "src/ui/design-system/kit/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", NO_MUTATING_SORT, NO_RETIRED_TOKENS, ...READABLE_RULES],
    },
  },
  {
    // The failure owner is the one file that words a failure; it comes after the kit's rules, which it narrows.
    files: ["src/ui/design-system/kit/service-failure.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        NO_MUTATING_SORT,
        NO_RETIRED_TOKENS,
        ...READABLE_RULES,
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
