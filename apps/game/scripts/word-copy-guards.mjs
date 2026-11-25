import { readFileSync, readdirSync } from "node:fs";
import tseslint from "typescript-eslint";

const WORD_COPY_MIN_LENGTH = 12;

const KIT_WORDS = new URL("../src/ui/design-system/kit/words.ts", import.meta.url);
const TYPES_WORDS = new URL("../../../packages/types/src/words/", import.meta.url);
const NOT_PLAYER_WORDS = new Set(["voice.ts"]);

const WORD_SOURCES = [
  KIT_WORDS,
  ...readdirSync(TYPES_WORDS)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && !NOT_PLAYER_WORDS.has(name))
    .map((name) => new URL(name, TYPES_WORDS)),
];

const SKIPPED_KEYS = new Set(["parent", "loc", "range", "tokens", "comments"]);

const isPropertyKey = (node, parent) => parent?.type === "Property" && parent.key === node && !parent.computed;
const isModuleSource = (parent) =>
  parent?.type === "ImportDeclaration" ||
  parent?.type === "ExportNamedDeclaration" ||
  parent?.type === "ExportAllDeclaration";
const isTypeOnly = (parent) => parent?.type === "TSLiteralType";
const isDeveloperMessage = (parent) => parent?.type === "NewExpression" && parent.callee.name === "Error";

const isPhraseSite = (node, parent) =>
  !isPropertyKey(node, parent) && !isModuleSource(parent) && !isTypeOnly(parent) && !isDeveloperMessage(parent);

const staticLength = (parts) => parts.reduce((sum, part) => sum + part.trim().length, 0);

const asPattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const templatePattern = (parts) => new RegExp(`^${parts.map(asPattern).join(".+?")}$`, "s");

const visit = (node, parent, found) => {
  if (!node || typeof node.type !== "string") return;
  if (node.type === "Literal" && typeof node.value === "string" && isPhraseSite(node, parent)) {
    found.whole.add(node.value);
  }
  if (node.type === "TemplateLiteral" && isPhraseSite(node, parent)) {
    const parts = node.quasis.map((quasi) => quasi.value.cooked ?? "");
    if (node.expressions.length === 0) found.whole.add(parts[0]);
    else if (staticLength(parts) >= WORD_COPY_MIN_LENGTH) found.templates.push(templatePattern(parts));
  }
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object") visit(child, node, found);
    }
  }
};

export const readPlayerPhrases = (sources = WORD_SOURCES.map((url) => readFileSync(url, "utf8"))) => {
  const found = { whole: new Set(), templates: [] };
  for (const source of sources) visit(tseslint.parser.parseForESLint(source).ast, undefined, found);
  const whole = new Set([...found.whole].filter((text) => text.trim().length >= WORD_COPY_MIN_LENGTH));
  if (whole.size === 0) throw new Error("No player phrases read from the words modules");
  return { whole, templates: found.templates };
};

export const copiesAPhrase = ({ whole, templates }, text) =>
  text.trim().length >= WORD_COPY_MIN_LENGTH && (whole.has(text) || templates.some((template) => template.test(text)));

const PHRASES = readPlayerPhrases();

const TEST_CALLS = new Set(["describe", "it", "test"]);
const calleeRoot = (callee) => (callee?.type === "MemberExpression" ? calleeRoot(callee.object) : callee);
const isExpectation = (node) => node.type === "CallExpression" && calleeRoot(node.callee)?.name === "expect";
const isTitle = (node, parent) =>
  parent?.type === "CallExpression" &&
  parent.arguments[0] === node &&
  TEST_CALLS.has(calleeRoot(parent.callee.type === "CallExpression" ? parent.callee.callee : parent.callee)?.name);
const isInputValue = (ancestor, child) => ancestor.type === "Property" && ancestor.value === child;

const COPY = "copy";
const STAND_IN = "standIn";

const noCopiedPhrase = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      [COPY]:
        "One source per fact: this string is a player phrase the words table holds. Read it from the table " +
        "(kit/words.ts or @bibliothecadao/types' words), so a reworded phrase cannot break the test.",
      [STAND_IN]:
        "A test checks what the code says: expect.any(String) checks nothing. Read the phrase from the words table, " +
        "or match the shape the value must have.",
    },
  },
  create: (context) => {
    const isChecked = (node) => {
      const ancestors = context.sourceCode.getAncestors(node);
      if (ancestors.some(isExpectation)) return true;
      const parent = ancestors.at(-1);
      if (isTitle(node, parent)) return false;
      return !ancestors.some((ancestor, index) => isInputValue(ancestor, ancestors[index + 1] ?? node));
    };
    const check = (node, text) => {
      if (copiesAPhrase(PHRASES, text) && isChecked(node)) context.report({ node, messageId: COPY });
    };
    return {
      CallExpression(node) {
        const { callee } = node;
        const isAny = callee.type === "MemberExpression" && callee.object.name === "expect" && callee.property.name === "any";
        if (isAny && node.arguments[0]?.type === "Identifier" && node.arguments[0].name === "String")
          context.report({ node, messageId: STAND_IN });
      },
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) check(node, node.quasis[0].value.cooked ?? "");
      },
    };
  },
};

const WORD_COPY_FILES = [
  "apps/game/src/**/*.test.{ts,tsx}",
  "packages/*/src/**/*.test.{ts,tsx}",
  "apps/game/scripts/**/*.test.mjs",
  "apps/game/scripts/**/*steps*.mjs",
];

export const wordCopyGuardConfigs = [
  {
    files: WORD_COPY_FILES,
    ignores: ["packages/types/src/words/**"],
    plugins: { words: { rules: { "no-copied-phrase": noCopiedPhrase } } },
    rules: { "words/no-copied-phrase": "error" },
  },
];
