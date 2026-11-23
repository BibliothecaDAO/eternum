import { readFileSync } from "node:fs";
import tseslint from "typescript-eslint";
import {
  CODE_ATTRIBUTES,
  CODE_CALLS,
  CODE_TOKEN,
  ERROR_CONSTRUCTOR,
  LOG_CALL,
} from "../../../scripts/words/player-text.mjs";

const VOICE_SOURCE = new URL("../../../packages/types/src/words/voice.ts", import.meta.url);

const EQUALITY_OPERATORS = new Set(["===", "!==", "==", "!="]);

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

const calleeName = (node) => {
  const callee = node.callee;
  if (callee?.type === "Identifier") return callee.name;
  if (callee?.type === "MemberExpression" && !callee.computed) {
    const owner = callee.object.type === "Identifier" ? `${callee.object.name}.` : "";
    const prop = callee.property.type === "Identifier" ? callee.property.name : "";
    return `${owner}${prop}`;
  }
  return "";
};

const isNonPlayerContext = (node) => {
  const parent = node.parent;
  if (!parent) return true;
  if (
    parent.type === "ImportDeclaration" ||
    parent.type === "ExportNamedDeclaration" ||
    parent.type === "ExportAllDeclaration" ||
    parent.type === "ImportExpression"
  )
    return true;
  if (parent.type === "Property" && parent.key === node && !parent.computed) return true;
  if (parent.type === "MemberExpression" && parent.computed && parent.property === node) return true;
  if (parent.type === "SwitchCase" && parent.test === node) return true;
  if (parent.type === "BinaryExpression" && EQUALITY_OPERATORS.has(parent.operator)) return true;

  for (let up = parent; up; up = up.parent) {
    if (up.type.startsWith("TS") && up.type !== "TSAsExpression" && up.type !== "TSSatisfiesExpression") return true;
    if (up.type === "ThrowStatement") return true;
    if (up.type === "NewExpression" && (ERROR_CONSTRUCTOR.test(calleeName(up)) || calleeName(up) === "RegExp"))
      return true;
    if (up.type === "CallExpression" && (CODE_CALLS.test(calleeName(up)) || LOG_CALL.test(calleeName(up))))
      return true;
    if (up.type === "JSXAttribute") {
      const attrName = up.name?.type === "JSXIdentifier" ? up.name.name : "";
      if (CODE_ATTRIBUTES.test(attrName)) return true;
    }
    if (up.type === "BlockStatement" || up.type === "Program") break;
  }
  return false;
};

const createPlainWordsRule = (rules, { checkCodeTokens = false } = {}) => ({
  meta: {
    type: "problem",
    schema: [],
    messages: {
      banned: 'Plain words: avoid "{{banned}}" in player-facing text; use "{{use}}" instead.',
    },
  },
  create: (context) => {
    const check = (node, text, reportNode = node) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!checkCodeTokens && CODE_TOKEN.test(trimmed)) return;
      for (const rule of rules) {
        if (rule.pattern.test(trimmed)) {
          context.report({ node: reportNode, messageId: "banned", data: { banned: rule.banned, use: rule.use } });
          return;
        }
      }
    };
    return {
      Literal(node) {
        if (typeof node.value !== "string" || isNonPlayerContext(node)) return;
        check(node, node.value);
      },
      JSXText(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        if (isNonPlayerContext(node.parent)) return;
        check(node, node.value.cooked ?? "", node.parent);
      },
    };
  },
});

const ALL_BANNED = readBannedWords();
const STRICT_BANNED = ALL_BANNED.filter((rule) => rule.zeroTolerance);
const BASELINED_BANNED = ALL_BANNED.filter((rule) => !rule.zeroTolerance);

export const PLAIN_WORDS_STRICT_RULE = "plain-words/no-zero-tolerance";
export const PLAIN_WORDS_RULE = "plain-words/no-banned-words";

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
    files: ["apps/game/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
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
