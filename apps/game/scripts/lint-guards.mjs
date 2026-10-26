// The lint guards: the rules CI holds the client and its packages to, each closing a class of bug a review found.
// The repo's full ESLint config is not run in CI, so a rule that must hold lives here.
//   node scripts/lint-guards.mjs      fails, naming each hit (CI: pnpm --dir apps/game lint:guards)
import { ESLint } from "eslint";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { nameGuardConfigs } from "./name-guards.mjs";

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

// A HUD colour is a role (tokens.ts HUD_COLOR_CLASSES): it takes no opacity, so `bg-hud-muted/40` makes no class at all
// and the part it paints shows the track under it (a fight's lost troops drew black, not grey). The slash is written
// \x2F so the selector's regex holds no slash of its own.
const HUD_ROLE_OPACITY = [
  {
    selector:
      ":matches(Literal[value=/-hud-[a-z0-9-]+\\x2F[0-9]/], TemplateElement[value.raw=/-hud-[a-z0-9-]+\\x2F[0-9]/])",
    message: "A HUD colour role takes no opacity: the class is never made. Use the role whole, or another role.",
  },
];

// A render subscribed to the confirmed head runs again at every block, about once a second: the Frontier Feed redrew its
// 350 stories that way on a still map, a long frame each time on a laptop. Follow the head in the store
// (useConnectionStore.subscribe in an effect), or select only what the render shows from it.
const NO_HEAD_RENDER = [
  {
    selector:
      "CallExpression[callee.name='useConnectionStore'] > ArrowFunctionExpression > MemberExpression.body[property.name='lastConfirmedBlock']",
    message:
      "A render subscribed to the confirmed head runs at every block: follow it with useConnectionStore.subscribe, or select what the render shows.",
  },
];

// A gain is written by formatGain: one written by hand as "+" before an amount read "+<1 Labor" for a find under a unit,
// which players took for nothing found (feedback, 25 October). Flags a template, a sum or JSX text joining "+" to an
// amount writer.
const AMOUNT_WRITER = "/^format(Amount|Charge)$/";
const HAND_WRITTEN_GAIN = [
  {
    selector: `TemplateLiteral:has(> TemplateElement[value.raw=/\\+$/]):has(> CallExpression[callee.name=${AMOUNT_WRITER}])`,
    message:
      'A gain is formatGain(amount) (a find: findGain), never "+" before an amount, which reads "+<1" under a unit.',
  },
  {
    selector: `BinaryExpression[operator='+'][left.value='+'] > CallExpression.right[callee.name=${AMOUNT_WRITER}]`,
    message:
      'A gain is formatGain(amount) (a find: findGain), never "+" before an amount, which reads "+<1" under a unit.',
  },
  {
    selector: `JSXElement:has(> JSXText[value=/\\+$/]):has(> JSXExpressionContainer > CallExpression[callee.name=${AMOUNT_WRITER}])`,
    message:
      'A gain is formatGain(amount) (a find: findGain), never "+" before an amount, which reads "+<1" under a unit.',
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

// A hook called after an early return, or in a branch, runs in some renders and not others: when the condition flips
// React throws "Rendered more hooks than during the previous render" and the panel is gone (Transfer's Balances when a
// player's holdings crossed zero). Where the shorter render calls no stateful hook React cannot tell, so the bug waits
// for the first one added above the return; the rule catches both.
const HOOK_ORDER = { "react-hooks/rules-of-hooks": "error" };

// A name nothing reads is code left behind by a change: an import a refactor stopped using, a constant or helper whose
// caller went, a parameter every caller still fills. Delete it. A parameter that only holds a place (`_event`) follows
// the repo's `_` convention; a key named to leave it out of a rest object (`{ secret, ...rest }`) is read by that.
const UNUSED = {
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
};

// A memo, callback or effect that leaves out a value it reads keeps the old one (a name that never updates, a quote on
// the last market); one that lists a value it never reads hides the input it does read. A memo over the native store
// lists useNativeFacts' `facts` and reads `facts.store`; an effect that runs on its own trigger reads useLatest.
const HOOK_DEPENDENCIES = { "react-hooks/exhaustive-deps": "error" };

const eslint = new ESLint({
  cwd: REPO,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: SOURCES,
      languageOptions: { parser: tseslint.parser },
      linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
      plugins: { "react-hooks": reactHooks, "@typescript-eslint": tseslint.plugin },
      rules: { "no-restricted-syntax": ["error", ...NO_BITWISE_ID, ...HAND_WRITTEN_GAIN], ...HOOK_ORDER, ...UNUSED },
    },
    {
      files: ["apps/game/src/**/*.{ts,tsx}"],
      rules: {
        ...HOOK_DEPENDENCIES,
        "no-restricted-syntax": [
          "error",
          ...NO_BITWISE_ID,
          ...HUD_ROLE_OPACITY,
          ...NO_HEAD_RENDER,
          ...HAND_WRITTEN_GAIN,
        ],
      },
    },
    {
      files: ["apps/game/src/**/*.{ts,tsx}"],
      ignores: ["**/*.test.{ts,tsx}"],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: resolve(REPO, "apps/game") } },
      plugins: { "@typescript-eslint": tseslint.plugin },
      rules: TEXT_VALUES,
    },
    // Only the imperative consumers reach the imperative name readers, by resolved module (name-guards.mjs).
    ...nameGuardConfigs,
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
