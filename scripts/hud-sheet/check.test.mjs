import assert from "node:assert/strict";
import { test } from "node:test";

import { findViolations, lowered, ratchet, stepsOf } from "./check.mjs";

const COLORS = ["gold", "danger", "kit"];
const STEPS = ["caption", "body", "title-lg"];
const matches = (source) => findViolations(source, "x.tsx", COLORS, STEPS).map(({ match }) => match);

test("a HUD file drawn only with the sheet passes", () =>
  assert.deepEqual(
    matches(`<HudPanel title="Military"><span className="text-hud-body text-hud-muted border-hud-line flex gap-2 bg-transparent">
      <div className="border-b" /></span></HudPanel>
.mp-title { color: rgb(var(--hud-accent)); }`),
    [],
  ));

test("a one-off size, colour, type size or weight fails, each where it is written", () =>
  assert.deepEqual(
    matches(`<div className="text-[11px] h-[38px] w-[var(--hud-control)] text-gold/70 bg-black/40 border-kit-line text-hud-muted/50 text-xs text-caption font-semibold" style={{ color: "#f3d08a" }} />
.plate { font-size: 13px; background: rgba(0, 0, 0, 0.4); }`),
    [
      "text-[11px]",
      "h-[38px]",
      "w-[var(--hud-control)]",
      "#f3d08a",
      "text-gold/70",
      "bg-black/40",
      "border-kit-line",
      "text-hud-muted/50",
      "text-xs",
      "text-caption",
      "font-semibold",
      "rgba(",
      "font-size: 13px",
    ],
  ));

test("a raw select is refused outright, and the sheet's select is not", () =>
  assert.deepEqual(
    findViolations(
      `<select aria-label="Automation" value={mode}>
<HudSelect label="Automation" value={mode} options={PRESETS} onChange={choose} />
<span className="ui-select" />
<p>{selection}</p>`,
      "x.tsx",
      COLORS,
      STEPS,
    ),
    [{ path: "x.tsx", line: 1, rule: "raw <select>: use HudSelect", match: "<select", refused: true }],
  ));

test("the ratchet fails a file past its count, a file below it, and a new file holding any", () => {
  const counts = new Map([
    ["a.tsx", 3],
    ["b.tsx", 1],
    ["new.tsx", 1],
  ]);
  assert.deepEqual(ratchet(counts, { "a.tsx": 2, "b.tsx": 4, "gone.tsx": 1 }), {
    over: [
      ["a.tsx", 3],
      ["new.tsx", 1],
    ],
    under: [
      ["b.tsx", 4],
      ["gone.tsx", 1],
    ],
  });
});

test("lowering only lowers: a file at zero leaves the list, none is raised or added", () =>
  assert.deepEqual(
    lowered(
      new Map([
        ["a.tsx", 3],
        ["b.tsx", 1],
        ["new.tsx", 5],
      ]),
      { "a.tsx": 2, "b.tsx": 4, "gone.tsx": 1 },
    ),
    { "a.tsx": 2, "b.tsx": 1 },
  ));

test("the shell's type steps are read from the token file", () =>
  assert.deepEqual(
    stepsOf(`export const TYPE = {\n  /** a */\n  caption: ["14px", "20px"],\n  "title-lg": "40px",\n} as const;`),
    ["caption", "title-lg"],
  ));
