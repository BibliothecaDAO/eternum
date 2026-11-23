import { readFileSync } from "node:fs";
import tseslint from "typescript-eslint";
import { scanPlayerText } from "../../../scripts/words/player-text.mjs";

const VOICE_SOURCE = new URL("../../../packages/types/src/words/voice.ts", import.meta.url);

const unwrap = (node) =>
  node?.type === "TSAsExpression" || node?.type === "TSSatisfiesExpression" ? unwrap(node.expression) : node;

const propertyOf = (entry, key) =>
  entry?.type === "ObjectExpression"
    ? entry.properties.find((prop) => prop.type === "Property" && !prop.computed && prop.key.name === key)?.value
    : undefined;

const stringLiteral = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined);

const booleanLiteral = (node) => (node?.type === "Literal" && typeof node.value === "boolean" ? node.value : false);

const regexLiteral = (node) =>
  node?.type === "Literal" && node.regex ? new RegExp(node.regex.pattern, node.regex.flags) : undefined;

export const readBannedWords = (source = readFileSync(VOICE_SOURCE, "utf8")) => {
  const declarations = tseslint.parser
    .parseForESLint(source)
    .ast.body.flatMap((node) => node.declaration?.declarations ?? []);
  const array = unwrap(declarations.find((each) => each.id.name === "BANNED_WORDS")?.init);
  if (array?.type !== "ArrayExpression" || array.elements.length === 0) {
    throw new Error(`No BANNED_WORDS array in ${VOICE_SOURCE.pathname}`);
  }
  return array.elements.map((entry) => {
    const banned = stringLiteral(propertyOf(entry, "banned"));
    const use = stringLiteral(propertyOf(entry, "use"));
    const pattern = regexLiteral(propertyOf(entry, "pattern"));
    const zeroTolerance = booleanLiteral(propertyOf(entry, "zeroTolerance"));
    if (!banned || !use || !pattern) {
      throw new Error(`Invalid BANNED_WORDS entry in ${VOICE_SOURCE.pathname}`);
    }
    return { banned, use, pattern, zeroTolerance };
  });
};

const createPlainWordsRule = (rules, { checkCodeTokens = false } = {}) => ({
  meta: {
    type: "problem",
    schema: [],
    messages: {
      banned: 'Plain words: avoid "{{banned}}" in player-facing text; use "{{use}}" instead.',
    },
  },
  create: (context) => ({
    Program() {
      for (const match of scanPlayerText(context.sourceCode.text, context.filename, rules, { checkCodeTokens })) {
        context.report({
          loc: { line: match.line, column: match.column },
          messageId: "banned",
          data: { banned: match.rule.banned, use: match.rule.use },
        });
      }
    },
  }),
});

const ALL_BANNED = readBannedWords();
const STRICT_BANNED = ALL_BANNED.filter((rule) => rule.zeroTolerance);
const BASELINED_BANNED = ALL_BANNED.filter((rule) => !rule.zeroTolerance);

export const PLAIN_WORDS_STRICT_RULE = "plain-words/no-zero-tolerance";
export const PLAIN_WORDS_RULE = "plain-words/no-banned-words";

const PLAYER_TEXT_SOURCES = [
  "apps/game/src/**/*.{ts,tsx}",
  "packages/core/src/**/*.{ts,tsx}",
  "packages/notifications/src/**/*.{ts,tsx}",
  "packages/identity/src/**/*.{ts,tsx}",
  "packages/types/src/**/*.{ts,tsx}",
];

const IGNORED_FILES = [
  "packages/types/src/words/voice.ts",
  "apps/game/src/shell/generated/patch-notes.ts",
  "**/*.gen.{ts,tsx}",
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
  "**/*fixture*.{ts,tsx}",
  "apps/game/src/lab/**",
  "apps/game/src/ui/features/debug/**",
  "apps/game/src/three/debug/**",
  "apps/game/src/three/**/verification/**",
];

export const plainWordsGuardConfigs = [
  {
    files: PLAYER_TEXT_SOURCES,
    ignores: IGNORED_FILES,
    plugins: {
      "plain-words": {
        rules: {
          "no-zero-tolerance": createPlainWordsRule(STRICT_BANNED, { checkCodeTokens: true }),
          "no-banned-words": createPlainWordsRule(BASELINED_BANNED),
        },
      },
    },
    rules: {
      [PLAIN_WORDS_STRICT_RULE]: "error",
      [PLAIN_WORDS_RULE]: "error",
    },
  },
];
