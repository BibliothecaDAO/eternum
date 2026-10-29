import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { configColorsOf, findStylesheetViolations, findViolations, fontsOf, unlisted } from "./check.mjs";

const FONTS = ["game", "display", "ui", "body"];
const COLORS = ["gold", "danger", "light-red", "order"];
const matches = (source) => findViolations(source, "a.tsx", FONTS, COLORS).map(({ match }) => match);
const stylesheetMatches = (source) => findStylesheetViolations(source, "index.css").map(({ match }) => match);

test("the token file's faces are read from its FONTS", () => {
  const tokens = readFileSync(new URL("../../apps/game/src/tokens.ts", import.meta.url), "utf8");
  assert.deepEqual(fontsOf(tokens).sort(), [...FONTS].sort());
});

test("the Tailwind config's own colour names are read from its colors, without the shell's palettes", () => {
  const config = readFileSync(new URL("../../apps/game/tailwind.config.js", import.meta.url), "utf8");
  const colors = configColorsOf(config);
  assert.ok(colors.includes("gold") && colors.includes("danger") && colors.includes("order"));
  assert.ok(!colors.includes("kit") && !colors.includes("app"));
});

test("the app sheet's colour roles pass: they are the shell's palette too", () =>
  assert.deepEqual(matches(`className="text-app-ink bg-app-well border-app-line text-app-age"`), []));

test("token classes pass", () =>
  assert.deepEqual(
    matches(
      `<h1 className="font-display text-title leading-none rounded-plate font-extrabold wide:px-gutter-wide font-ui text-[var(--x)]" />`,
    ),
    [],
  ));

test("palette, shadow and gradient tokens pass, and so do lengths and words that only look like colours", () =>
  assert.deepEqual(
    matches(
      `className="bg-kit-gold/10 text-kit-cream border-kit-line2 shadow-mark shadow-[var(--x)] bg-halo border-[3px] text-left bg-transparent from-kit-ground to-transparent ring-kit-peach" // gold, the order`,
    ),
    [],
  ));

for (const [what, source, expected] of [
  ["an arbitrary text size", `className="text-[15px] lg:text-[2.5rem]"`, ["text-[15px]", "text-[2.5rem]"]],
  [
    "a raw colour",
    `color: "#dfaa54", shadow-[0_2px_8px_rgba(0,0,0,0.6)] oklch(22% 0 0)`,
    ["#dfaa54", "rgba(", "oklch(", "shadow-[0_2px_8px_rgba(0,0,0,0.6)]"],
  ],
  ["an arbitrary radius", `className="rounded-[14px]"`, ["rounded-[14px]"]],
  ["the wide screen written out", `className="min-[1800px]:px-12"`, ["min-[1800px]:"]],
  ["a face the token file does not define", `className="font-cinzel font-[Exo]"`, ["font-cinzel", "font-[Exo]"]],
  ["a hsl colour", `color: "hsl(30 50% 50%)"`, ["hsl("]],
  [
    "a colour outside the palette",
    `className="text-gold bg-black/30 border-light-red hover:bg-red-500 text-white text-order-power text-danger"`,
    ["text-gold", "bg-black", "border-light-red", "bg-red-500", "text-white", "text-order-power", "text-danger"],
  ],
  [
    "an arbitrary gradient or theme colour",
    `className="bg-[radial-gradient(circle,theme(colors.kit.gold/30%),transparent_65%)] border-[theme(colors.kit.line)]"`,
    ["bg-[radial-gradient(circle,theme(colors.kit.gold/30%),transparent_65%)]", "border-[theme(colors.kit.line)]"],
  ],
  [
    "an arbitrary shadow",
    `className="shadow-[0_0_0_3px_theme(colors.kit.sage/25%)] drop-shadow-[0_2px_4px_black]"`,
    ["shadow-[0_0_0_3px_theme(colors.kit.sage/25%)]", "drop-shadow-[0_2px_4px_black]"],
  ],
])
  test(`${what} fails`, () => assert.deepEqual(matches(source), expected));

test("a violation is reported with its line", () =>
  assert.deepEqual(findViolations(`ok\n<p className="text-[15px]" />`, "a.tsx", FONTS)[0].line, 2));

test("the allowlist covers listed sites up to their count, and a fixed site must leave it", () => {
  const violations = findViolations(`text-[15px] text-[15px]`, "a.tsx", FONTS);
  const entry = (count) => [{ file: "a.tsx", match: "text-[15px]", count, reason: "r", issue: "#1" }];
  assert.deepEqual(unlisted(violations, entry(2)), { extra: [], stale: [] });
  assert.equal(unlisted(violations, entry(1)).extra.length, 2);
  assert.equal(unlisted(violations, entry(3)).stale.length, 1);
  assert.equal(unlisted([], entry(1)).stale.length, 1);
});

test("the shell's index.css classes pass when they draw only the token file's variables", () =>
  assert.deepEqual(
    stylesheetMatches(`
/* .plate { background: #fff } is a comment, not a rule */
.plate { @apply border border-kit-line bg-kit-plate; border-radius: var(--radius-plate); }
@media (min-width: 1024px) {
  .plate { background-image: var(--plate-face); box-shadow: var(--plate-shadow); }
}
html,
body { text-shadow: var(--text-shadow-ambient); }
.frontier-tier { background: linear-gradient(180deg, #ece6d8, #a8a194); }`),
    [],
  ));

test("a literal colour, image or theme() in a shell class fails, at its line", () => {
  const violations = findStylesheetViolations(
    `.frontier-primary {
  background: linear-gradient(180deg, #ffc24a, #e39001);
}
@layer components {
  @media (min-width: 1024px) {
    .painted::after { box-shadow: inset 0 0 0 4px theme(colors.kit.gold / 18%), 0 0 1px rgb(0 0 0 / 0.5); }
    .leather { background: url("/images/leather.svg"); }
  }
}
.frontier-chip[data-tone="loss"] .frontier-chip-number { color: rgba(255, 138, 115, 1); }
html, body { text-shadow: 2px 2px 4px hsl(60 100% 50% / 0.1); }`,
    "index.css",
  );
  assert.deepEqual(
    violations.map(({ line, match }) => [line, match]),
    [
      [2, "#ffc24a"],
      [2, "#e39001"],
      [6, "theme("],
      [6, "rgb("],
      [7, "url("],
      [10, "rgba("],
      [11, "hsl("],
    ],
  );
});

test("the real stylesheet's shell classes are scanned: each one appears in a rule", () => {
  const css = readFileSync(new URL("../../apps/game/src/index.css", import.meta.url), "utf8");
  for (const name of ["frontier-primary", "frontier-sheet", "plate", "plate-title", "painted", "leather"])
    assert.match(css, new RegExp(`\\.${name}\\b[^{]*\\{`));
});
