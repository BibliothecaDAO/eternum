// The lint guards: the rules CI holds the client and its packages to, each closing a class of bug a review found.
// The repo's full ESLint config is not run in CI, so a rule that must hold lives here.
//   node scripts/lint-guards.mjs      fails, naming each hit (CI: pnpm --dir apps/game lint:guards)
//   node scripts/lint-guards.mjs --write-catalog-baseline   records the catalog copies standing, once some are removed
import { ESLint } from "eslint";
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { CATALOG_RULE, catalogGuardConfigs, planCatalogBaseline } from "./catalog-guards.mjs";
import { findUnownedKitSheetClasses } from "./kit-sheet-guards.mjs";
import { modelUrlGuardConfigs } from "./model-url-guards.mjs";
import { nameGuardConfigs } from "./name-guards.mjs";
import { noBackGuardConfigs } from "./no-back-guards.mjs";
import { PLAIN_WORDS_RULE, plainWordsGuardConfigs } from "./plain-words-guards.mjs";
import { threeDebugGuardConfigs } from "./three-debug-guards.mjs";
import { wordCopyGuardConfigs } from "./word-copy-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCES = ["apps/game/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"];
const SCRIPTS = ["apps/game/scripts/**/*.{js,mjs}"];

// agent-browser runs at the one version lib/agent-browser.mjs pins. A script that names the package itself (`npx -y
// agent-browser`) fetches the newest on every run: 0.42.0 turned the terrain gallery's captures blank overnight.
const UNPINNED_AGENT_BROWSER = [
  {
    selector:
      ":matches(Literal[value=/^agent-browser(@|$)/], Literal[value=/npx( -y)? agent-browser/], TemplateElement[value.raw=/npx( -y)? agent-browser/])",
    message: "agent-browser runs at the version lib/agent-browser.mjs pins: spawn `npx -y ${AGENT_BROWSER}`.",
  },
];

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

const WONDER_LOOK_IS_THE_SKIN = [
  {
    selector: "MemberExpression[property.name='has_wonder'][object.property.name='metadata']",
    message:
      "A realm is drawn by realmShowsWonder (its owner may equip another skin) and its holdings and costs read holdsWonder: never metadata.has_wonder.",
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
const KIT_SHEETS = [
  resolve(REPO, "apps/game/src/ui/design-system/kit/hud-sheet.css"),
  resolve(REPO, "apps/game/src/ui/design-system/kit/app-sheet.css"),
];
const KIT_CHOSEN_CLASSES = [
  ...new Set(
    KIT_SHEETS.flatMap((file) =>
      [
        ...readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .matchAll(
            /\.((?:ui|app)-[a-z0-9_-]+)(?:\[[^\]]*\])*(?:\[(?:aria-pressed|aria-selected)="true"\]|\[data-selected\]|:is\([^)]*(?:aria-pressed="true"|aria-selected="true"|data-selected)[^)]*\))/g,
          ),
      ].map((match) => match[1]),
    ),
  ),
];
const KIT_CLASS = `/(^|\\s)(${KIT_CHOSEN_CLASSES.join("|")})(\\s|$)/`;
const CHOSEN_STATE_IS_THE_KIT = [
  {
    selector: `JSXOpeningElement[name.name=/^[a-z]/]:has(JSXAttribute[name.name=/^(aria-pressed|aria-selected|data-selected)$/]):not(:has(JSXAttribute[name.name='className'] :matches(Literal[value=${KIT_CLASS}], TemplateElement[value.raw=${KIT_CLASS}])))`,
    message: `An element that says it is chosen wears the kit's chosen look: put a kit chosen class (${KIT_CHOSEN_CLASSES.map((name) => `\`${name}\``).join(", ")}) in its className, not a border or fill of its own.`,
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

// A price a surface shows is HudPrice: each price's painting and its amount. The Build sheet's foot read its price as
// words through HudCost while Deploy's and the Castle's showed paintings: one fact, two forms in the same slot (audit,
// 25 November). HudCost's words stay the map's order line under the pointer, outside the features.
const PRICE_IS_HUD_PRICE = [
  {
    selector: "JSXOpeningElement[name.name='HudCost']",
    message:
      "A surface shows a price with HudPrice (its painting and amount); HudCost's words are the map's order line.",
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
          ...WONDER_LOOK_IS_THE_SKIN,
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
      files: ["apps/game/src/ui/features/**/*.{ts,tsx}", "apps/game/src/shell/**/*.{ts,tsx}"],
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
          ...PRICE_IS_HUD_PRICE,
          ...WONDER_LOOK_IS_THE_SKIN,
        ],
      },
    },
    {
      files: SCRIPTS,
      ignores: ["apps/game/scripts/lib/agent-browser.mjs"],
      linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
      rules: { "no-restricted-syntax": ["error", ...UNPINNED_AGENT_BROWSER] },
    },
    // Only the imperative consumers reach the imperative name readers, by resolved module (name-guards.mjs).
    ...nameGuardConfigs,
    // No Back link or row arrow on any screen (no-back-guards.mjs).
    ...noBackGuardConfigs,
    ...threeDebugGuardConfigs,
    ...modelUrlGuardConfigs,
    ...catalogGuardConfigs,
    ...plainWordsGuardConfigs,
    ...wordCopyGuardConfigs,
  ],
});

const results = await eslint.lintFiles([...SOURCES, ...SCRIPTS]);
const errors = results.flatMap((result) =>
  result.messages
    .filter((message) => message.fatal || message.severity === 2)
    .map((message) => ({ file: relative(REPO, result.filePath), message })),
);
const line = ({ file, message }) => `${file}:${message.line}:${message.column} ${message.message}`;
const isCatalogCopy = ({ message }) => message.ruleId === CATALOG_RULE;
const isPlainWords = ({ message }) => message.ruleId === PLAIN_WORDS_RULE;

const checkBaseline = (matched, baselineName, flag) => {
  const baselinePath = resolve(dirname(fileURLToPath(import.meta.url)), baselineName);
  const byFile = new Map();
  for (const hit of matched) byFile.set(hit.file, [...(byFile.get(hit.file) ?? []), hit]);
  const counts = Object.fromEntries([...byFile].map(([file, items]) => [file, items.length]));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const { additions, write } = planCatalogBaseline(counts, baseline, {
    lowering: process.argv.includes(flag),
  });
  if (write) writeFileSync(baselinePath, `${JSON.stringify(write, null, 2)}\n`);
  return additions.flatMap((file) => byFile.get(file).map(line));
};

const catalogHits = checkBaseline(
  errors.filter(isCatalogCopy),
  "catalog-copies-baseline.json",
  "--write-catalog-baseline",
);
const plainWordsHits = checkBaseline(
  errors.filter(isPlainWords),
  "plain-words-baseline.json",
  "--write-plain-words-baseline",
);

const findDottedThemeKeys = () =>
  globSync("apps/game/src/**/*.css", { cwd: REPO }).flatMap((file) =>
    readFileSync(resolve(REPO, file), "utf8")
      .split("\n")
      .flatMap((text, index) =>
        /theme\([\w-]+\.\d+\.\d/.test(text)
          ? [
              `${file}:${index + 1} theme() splits a key at its dot and reads a character of another value (spacing.2.5 gave "m"): write theme(spacing[2.5]).`,
            ]
          : [],
      ),
  );

const findShortInAmber = () =>
  globSync("apps/game/src/**/*.css", { cwd: REPO }).flatMap((file) =>
    [...readFileSync(resolve(REPO, file), "utf8").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, body]) => selector.includes("[data-short") && /--(hud|app)-warn\b/.test(body))
      .map(
        ([, selector]) =>
          `${file}: ${selector.trim()} paints what the player cannot pay for in amber: a short price is red, read from HudPrice's short.`,
      ),
  );

const hits = [
  ...errors.filter((error) => !isCatalogCopy(error) && !isPlainWords(error)).map(line),
  ...catalogHits,
  ...plainWordsHits,
  ...findUnownedKitSheetClasses(),
  ...findDottedThemeKeys(),
  ...findShortInAmber(),
];
for (const hit of hits) console.log(hit);
console.log(`lint guards: ${hits.length} hit(s)`);
process.exitCode = hits.length > 0 ? 1 : 0;
