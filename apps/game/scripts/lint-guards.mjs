// The lint guards: the rules CI holds the client and its packages to, each closing a class of bug a review found.
// The repo's full ESLint config is not run in CI, so a rule that must hold lives here.
//   node scripts/lint-guards.mjs      fails, naming each hit (CI: pnpm --dir apps/game lint:guards)
import { ESLint } from "eslint";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCES = ["apps/game/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"];

// An entity id is its home's namespace times 2^32 plus a serial; a bitwise operator or Math.imul keeps only the low 32
// bits, so every home's Nth army hashed alike (one name for every player's second army). foldEntityId keeps both.
const ID = "/(^id|Id|ID)$/";
const ID_OPERAND = `:matches(Identifier[name=${ID}], MemberExpression[property.name=${ID}])`;
const NO_BITWISE_ID = [
  {
    selector: `BinaryExpression[operator=/^(\\^|\\||&|<<|>>|>>>)$/] > ${ID_OPERAND}`,
    message: "A bitwise operator drops an entity id's home (its high 32 bits): hash foldEntityId(id) instead.",
  },
  {
    selector: `CallExpression[callee.object.name='Math'][callee.property.name='imul'] > ${ID_OPERAND}`,
    message: "Math.imul drops an entity id's home (its high 32 bits): hash foldEntityId(id) instead.",
  },
];

// A function or an object written into text prints its source or "[object Object]": each resource chip's buttons read
// "Transfer (id) => {…}" where a words function was written in place of the word it returns. Typed, so client only.
const TEXT_VALUES = {
  "@typescript-eslint/restrict-template-expressions": [
    "error",
    { allowAny: true, allowBoolean: true, allowNever: true, allowNullish: true, allowNumber: true },
  ],
  "@typescript-eslint/restrict-plus-operands": "error",
};

const eslint = new ESLint({
  cwd: REPO,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: SOURCES,
      languageOptions: { parser: tseslint.parser },
      linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
      rules: { "no-restricted-syntax": ["error", ...NO_BITWISE_ID] },
    },
    {
      files: ["apps/game/src/**/*.{ts,tsx}"],
      ignores: ["**/*.test.{ts,tsx}"],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: resolve(REPO, "apps/game") } },
      plugins: { "@typescript-eslint": tseslint.plugin },
      rules: TEXT_VALUES,
    },
  ],
});

const results = await eslint.lintFiles(SOURCES);
const hits = results.flatMap((result) =>
  result.messages
    .filter((message) => message.fatal || message.severity === 2)
    .map((message) => `${relative(REPO, result.filePath)}:${message.line}:${message.column} ${message.message}`),
);
for (const hit of hits) console.log(hit);
console.log(`lint guards: ${hits.length} hit(s)`);
process.exitCode = hits.length > 0 ? 1 : 0;
