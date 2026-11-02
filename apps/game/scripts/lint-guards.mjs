// The lint guards: the rules CI holds the client and its packages to, each closing a class of bug a review found.
// The repo's full ESLint config is not run in CI, so a rule that must hold lives here.
//   node scripts/lint-guards.mjs      fails, naming each hit (CI: pnpm --dir apps/game lint:guards)
//   node scripts/lint-guards.mjs --write-catalog-baseline   records the catalog copies standing, once some are removed
import { ESLint } from "eslint";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { CATALOG_RULE, catalogGuardConfigs, planCatalogBaseline } from "./catalog-guards.mjs";
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

// No page has Back and no row carries an arrow (the owner's pick A, 2 November 2026: "I feel like no one does that
// nowadays"): the places in the bar are the way out of a page, a sheet closes on its cross, and a row opens on a press
// anywhere along it. These are the shapes the Back links and row arrows took, so none comes back.
const NO_BACK_MESSAGE =
  "No Back link or row arrow: a page's places are its way out, a sheet closes on its cross, a row opens on a press.";
const NO_BACK = [
  "JSXAttribute[name.name='data-role'][value.value='back']",
  "JSXAttribute[name.name=/^(icon|name)$/][value.value=/^chevron-(left|right)$/]",
  "JSXAttribute[name.name=/^(back|onBack|opens)$/]",
  "Property[key.name=/^(onBack|opens)$/]",
  "JSXAttribute[name.name=/^(aria-label|label)$/][value.value='Back']",
  "JSXText[value=/^\\s*Back\\s*$/]",
  "Identifier[name='BACK']",
].map((selector) => ({ selector, message: NO_BACK_MESSAGE }));

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

// A chip or a pill writes its number short (owner, 26 October: "+1,000" was "horrible on desktop, just put 1k"): an
// amount, a charge or an exact count written into one runs a thousand out in full and pushes past its card.
const SHORT_IN_CHIPS = [
  {
    selector:
      "JSXElement[openingElement.name.name=/^Hud(Chip|Pill)$/] JSXExpressionContainer:not(JSXAttribute > JSXExpressionContainer) CallExpression[callee.name=/^format(Amount|Charge|Exact|Gain)$/]",
    message:
      "A chip or pill writes its number with formatShort (signed: true for a gain) or formatShortChange for a before → after.",
  },
];

// Every stamina bar is HudStamina, cut into a segment per explore (owner, 26 October: "split the bar in 20 stamina ?
// like on mobile ?"). The desktop army card, the map plates and the guard bars each drew a plain meter of their own.
const STAMINA_IS_SEGMENTED = [
  {
    selector:
      "JSXOpeningElement[name.name='HudMeter'] > JSXAttribute[name.name='label'] :matches(Literal[value=/stamina/i], Identifier[name='STAMINA'], TemplateElement[value.raw=/stamina/i])",
    message: "A stamina bar is HudStamina (a segment per explore), never a plain HudMeter.",
  },
];

// A chosen card, tile, token or option wears the kit's ring (`ui-pick` in hud-sheet.css), drawn inside its own box. A
// ring or outline of its own spilled past its column: the Research panel's chosen Well stood wider than the Shrine and
// Ethereal I above and below it (owner, 31 October). A focus ring keeps its state prefix (`focus-visible:ring-2`).
const CHOSEN_IS_THE_KIT_PICK = [
  {
    selector:
      ":matches(Literal[value=/(^|\\s)(ring|outline|outline-offset)-[0-9]/], TemplateElement[value.raw=/(^|\\s)(ring|outline|outline-offset)-[0-9]/])",
    message:
      "A chosen thing wears the kit's ring: give it `ui-pick` and aria-pressed (or data-selected), not a ring or outline of its own.",
  },
];

// An element that says it is chosen (aria-pressed, aria-selected, data-selected) is drawn chosen by the kit: `ui-pick`, or
// one of the kit's own chosen forms (`ui-row`, `ui-tab`…), written on the element itself. A border or fill of its own
// left four pickers on their own looks after the kit's one was made (review, 31 October: a guard slot, a resource card,
// a transfer slot's Balance, a phone's action tile).
const KIT_CLASS = "/(^|\\s)ui-/";
const CHOSEN_STATE_IS_THE_KIT = [
  {
    selector: `JSXOpeningElement[name.name=/^[a-z]/]:has(JSXAttribute[name.name=/^(aria-pressed|aria-selected|data-selected)$/]):not(:has(JSXAttribute[name.name='className'] :matches(Literal[value=${KIT_CLASS}], TemplateElement[value.raw=${KIT_CLASS}])))`,
    message:
      "An element that says it is chosen wears the kit's chosen look: put `ui-pick` (or the kit's ui- class) in its className, not a border or fill of its own.",
  },
];

// The same omission when the element declares no state at all: a class chosen by a condition that sets both a border
// colour and a fill is a chosen look of its own (a guard slot's "border-hud-line-strong bg-hud-chosen", a resource
// card's, a transfer slot's "border-hud-line-strong bg-hud-hover"). A dashed border is a drop zone, not a choice.
const CHOSEN_LOOK =
  "/^(?!.*border-dashed).*((^|\\s)border-hud-(line-strong|accent|chosen)\\b.*(^|\\s)bg-hud-(chosen|hover)\\b|(^|\\s)bg-hud-(chosen|hover)\\b.*(^|\\s)border-hud-(line-strong|accent|chosen)\\b)/";
const CHOSEN_LOOK_IS_THE_KIT = [
  {
    selector: `:matches(LogicalExpression[operator='&&'] > Literal.right, ConditionalExpression > Literal.consequent, ConditionalExpression > Literal.alternate)[value=${CHOSEN_LOOK}]`,
    message:
      "A border and a fill chosen by a condition is a chosen look of its own: give the element `ui-pick` and say it is chosen (aria-pressed or data-selected).",
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
      rules: {
        "no-restricted-syntax": ["error", ...NO_BITWISE_ID, ...HAND_WRITTEN_GAIN],
        ...HOOK_ORDER,
        ...UNUSED,
      },
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
          ...SHORT_IN_CHIPS,
          ...STAMINA_IS_SEGMENTED,
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
    {
      files: ["apps/game/src/**/*.tsx"],
      ignores: ["apps/game/src/ui/features/debug/**", "**/*.test.tsx"],
      rules: {
        "no-restricted-syntax": [
          "error",
          ...NO_BITWISE_ID,
          ...HUD_ROLE_OPACITY,
          ...NO_HEAD_RENDER,
          ...HAND_WRITTEN_GAIN,
          ...SHORT_IN_CHIPS,
          ...STAMINA_IS_SEGMENTED,
          ...NO_BACK,
        ],
      },
    },
    {
      files: ["apps/game/src/ui/features/**/*.{ts,tsx}"],
      ignores: ["apps/game/src/ui/features/debug/**", "**/*.test.{ts,tsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          ...NO_BITWISE_ID,
          ...HUD_ROLE_OPACITY,
          ...NO_HEAD_RENDER,
          ...HAND_WRITTEN_GAIN,
          ...SHORT_IN_CHIPS,
          ...STAMINA_IS_SEGMENTED,
          ...CHOSEN_IS_THE_KIT_PICK,
          ...CHOSEN_STATE_IS_THE_KIT,
          ...CHOSEN_LOOK_IS_THE_KIT,
          ...NO_BACK,
        ],
      },
    },
    // Only the imperative consumers reach the imperative name readers, by resolved module (name-guards.mjs).
    ...nameGuardConfigs,
    // One source per fact: no list or partial map of a catalog's members outside its modules (catalog-guards.mjs).
    ...catalogGuardConfigs,
  ],
});

const results = await eslint.lintFiles(SOURCES);
const errors = results.flatMap((result) =>
  result.messages
    .filter((message) => message.fatal || message.severity === 2)
    .map((message) => ({ file: relative(REPO, result.filePath), message })),
);
const line = ({ file, message }) => `${file}:${message.line}:${message.column} ${message.message}`;
const isCatalogCopy = ({ message }) => message.ruleId === CATALOG_RULE;

// The catalog copies that stood when the guard came, a count per file: a file may hold no more than its count, and
// once one is removed --write-catalog-baseline lowers the count. It writes nothing while any file holds more than its
// count or is new to the baseline, so the copies only ever fall.
const BASELINE = resolve(dirname(fileURLToPath(import.meta.url)), "catalog-copies-baseline.json");
const copiesByFile = new Map();
for (const copy of errors.filter(isCatalogCopy))
  copiesByFile.set(copy.file, [...(copiesByFile.get(copy.file) ?? []), copy]);
const counts = Object.fromEntries([...copiesByFile].map(([file, copies]) => [file, copies.length]));
const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const { additions, unlowered, write } = planCatalogBaseline(counts, baseline, {
  lowering: process.argv.includes("--write-catalog-baseline"),
});
if (write) writeFileSync(BASELINE, `${JSON.stringify(write, null, 2)}\n`);
const catalogHits = [
  ...additions.flatMap((file) => copiesByFile.get(file).map(line)),
  ...unlowered.map(
    (file) =>
      `${file} holds ${counts[file] ?? 0} catalog copies, under its baseline of ${baseline[file]}: run --write-catalog-baseline`,
  ),
];

const hits = [...errors.filter((error) => !isCatalogCopy(error)).map(line), ...catalogHits];
for (const hit of hits) console.log(hit);
console.log(`lint guards: ${hits.length} hit(s)`);
process.exitCode = hits.length > 0 ? 1 : 0;
