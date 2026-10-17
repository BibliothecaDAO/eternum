import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findViolations, fontsOf, unlisted } from "./check.mjs";

const FONTS = ["display", "ui", "body"];
const matches = (source) => findViolations(source, "a.tsx", FONTS).map(({ match }) => match);

test("the token file's faces are read from its FONTS", () => {
  const tokens = readFileSync(new URL("../../apps/game/src/tokens.ts", import.meta.url), "utf8");
  assert.deepEqual(fontsOf(tokens).sort(), [...FONTS].sort());
});

test("token classes pass", () =>
  assert.deepEqual(
    matches(
      `<h1 className="font-display text-title leading-none rounded-plate font-extrabold wide:px-gutter-wide font-ui text-[var(--x)]" />`,
    ),
    [],
  ));

for (const [what, source, expected] of [
  ["an arbitrary text size", `className="text-[15px] lg:text-[2.5rem]"`, ["text-[15px]", "text-[2.5rem]"]],
  [
    "a raw colour",
    `color: "#dfaa54", shadow-[0_2px_8px_rgba(0,0,0,0.6)] oklch(22% 0 0)`,
    ["#dfaa54", "rgba(", "oklch("],
  ],
  ["an arbitrary radius", `className="rounded-[14px]"`, ["rounded-[14px]"]],
  ["the wide screen written out", `className="min-[1800px]:px-12"`, ["min-[1800px]:"]],
  ["a face the token file does not define", `className="font-cinzel font-[Exo]"`, ["font-cinzel", "font-[Exo]"]],
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
