// No page has Back and no row carries an arrow (the owner's pick A, 2 November 2026: "I feel like no one does that
// nowadays"): the places in the bar are the way out of a page, a sheet closes on its cross, and a row opens on a press
// anywhere along it. These are the shapes the Back links and row arrows took, so none comes back. An arrow that is not a
// way somewhere stays: a pager's previous and next, the arrow between two numbers, a verb's icon beside its words.
// lint-guards.mjs runs it in CI; src/no-back-guards.test.mjs holds its negative controls.

const ICON = "JSXAttribute[name.name=/^(name|icon)$/]";

/** Each shape, by the syntax it takes, with what it is. */
const SHAPES = [
  ["JSXAttribute[name.name='data-role'][value.value='back']", "a Back link"],
  [`${ICON}[value.value=/^chevron-(left|right)$/]`, "a chevron arrow"],
  ["JSXAttribute[name.name=/^(back|onBack|opens)$/]", "a Back or row-arrow prop"],
  ["Property[key.name=/^(onBack|opens)$/]", "a Back or row-arrow key"],
  ["JSXAttribute[name.name=/^(aria-label|label)$/][value.value='Back']", "a Back label"],
  ["JSXText[value=/^\\s*Back\\s*$/]", "a Back label"],
  ["Identifier[name='BACK']", "the Back word"],
  // A row's arrow: one in what a row ends on, or one drawn on a condition (the setting row's former
  // `(onClick || href) && <Icon name="arrow-right" />`, a wallet row's pending word or its arrow).
  [`JSXAttribute[name.name=/^(trail|trailing|control)$/] ${ICON}[value.value='arrow-right']`, "a row's arrow"],
  [
    `:matches(LogicalExpression, ConditionalExpression) > JSXElement > JSXOpeningElement > ${ICON}[value.value='arrow-right']`,
    "a row's arrow",
  ],
];

const MESSAGE =
  "No Back link or row arrow: a page's places are its way out, a sheet closes on its cross, a row opens on a press";

const noBack = {
  meta: { type: "problem", schema: [] },
  create: (context) =>
    Object.fromEntries(
      SHAPES.map(([selector, shape]) => [
        selector,
        (node) => context.report({ node, message: `${MESSAGE} (${shape}).` }),
      ]),
    ),
};

/** Every app and HUD screen, its tests and the debug tools aside. */
export const noBackGuardConfigs = [
  {
    files: ["apps/game/src/**/*.tsx"],
    ignores: ["**/*.test.tsx", "apps/game/src/ui/features/debug/**"],
    plugins: { "no-back": { rules: { "no-back": noBack } } },
    rules: { "no-back/no-back": "error" },
  },
];
