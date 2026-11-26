import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findSurfaceResets,
  findViolations,
  kitSurfaceClasses,
  kitSurfaceComponents,
  lowered,
  ratchet,
  stepsOf,
  surfaceCompanions,
} from "./check.mjs";

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

test("a Frontier sheet that copies the kit's surface is refused, and the same copy elsewhere is left to its own sheet", () => {
  const copy = `.card { border: 1px solid var(--hud-line); background: linear-gradient(180deg, var(--hud-surface-from), var(--hud-surface-to)); }`;
  const found = (path) => findViolations(copy, path, COLORS, STEPS);
  assert.deepEqual(
    found("apps/game/src/ui/features/frontier/hud/card.css").map(({ refused }) => refused),
    [true],
  );
  assert.deepEqual(found("apps/game/src/three/map-plates/map-plates.css"), []);
});

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

test("a raw input is counted, and the sheet's fields are not", () =>
  assert.deepEqual(
    findViolations(
      `<input aria-label="Whole LORDS to deposit" inputMode="numeric" value={amount} />
<HudField aria-label="Whole LORDS to deposit" inputMode="numeric" value={amount} onChange={setAmount} />
<AmountInput label="LORDS" value={amount} max={held} onChange={onAmount} />
<label className="ui-field" />`,
      "x.tsx",
      COLORS,
      STEPS,
    ),
    [{ path: "x.tsx", line: 1, rule: "raw <input>: use HudField", match: "<input", refused: false }],
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

const GROUND = "background: linear-gradient(180deg, var(--hud-surface-from), var(--hud-surface-to));";
const SURFACES = kitSurfaceClasses(`/* The panel. */
.ui-panel { ${GROUND} }
.ui-popover,
.ui-pill { border: 1px solid var(--hud-line); ${GROUND} }
.ui-confirm { ${GROUND} }
.ui-panel__head { color: var(--hud-muted); }
.ui-chip { background: var(--hud-well); }`);

test("the kit's surfaces are the kit classes its sheet paints with the surface ground", () =>
  assert.deepEqual([...SURFACES].sort(), ["ui-confirm", "ui-panel", "ui-pill", "ui-popover"]));

test("a feature reset that would wipe a kit surface is refused, and the same reset kept off kit surfaces passes", () => {
  const companions = surfaceCompanions(
    `<button className={desktop ? "ui-popover frontier-quest-orb" : "frontier-quest-orb"} />
<div className={cn(open && "ui-pill", "frontier-day")} />
<button className={\`ui-popover frontier-orb\${phone ? " frontier-orb--phone" : ""}\`} />
<div className="frontier-dock" />
<div className="ui-confirm alerts-popup" />`,
    SURFACES,
  );
  assert.deepEqual(
    [...companions].map(([name, drawn]) => [name, [...drawn]]),
    [
      ["frontier-quest-orb", ["ui-popover"]],
      ["frontier-day", ["ui-pill"]],
      ["frontier-orb", ["ui-popover"]],
      ["frontier-orb--phone", ["ui-popover"]],
      ["alerts-popup", ["ui-confirm"]],
    ],
  );
  const resets = findSurfaceResets(
    `.frontier-quest-orb {
  border: 0;
  background: transparent;
}
.frontier-crown .frontier-quest-orb { border: none; }
.frontier-quest-orb:not(.ui-popover) { border: 0; background: transparent; }
.frontier-quest-orb:not(.ui-pick) { border: 0; }
.frontier-day { background: transparent !important; border: 0 none; }
.frontier-dock { background: transparent; }
.alerts-popup { background: transparent; }
.alerts-popup:not(.ui-popover) { border: 0; }
.alerts-popup:not(.ui-confirm) { border: 0; }
.frontier-crown .ui-popover { background: none; }
.frontier-crown > button { border: 0; }
/* The card fades. */
.frontier-fade { background: transparent; }
.frontier-quest-orb:not(.ui-panel, .ui-popover) { border: 0; }
.frontier-quest-orb::after { background: linear-gradient(180deg, transparent 35%, var(--hud-surface-from)); }
@media (max-width: 700px) {
  .frontier-quest-orb .frontier-ring { border: 0; }
}`,
    "apps/game/src/ui/features/frontier/hud/bar.css",
    companions,
    SURFACES,
  );
  assert.deepEqual(
    resets.map(({ line, match, refused }) => [line, match, refused]),
    [
      [1, ".frontier-quest-orb", true],
      [5, ".frontier-crown .frontier-quest-orb", true],
      [7, ".frontier-quest-orb:not(.ui-pick)", true],
      [8, ".frontier-day", true],
      [10, ".alerts-popup", true],
      [11, ".alerts-popup:not(.ui-popover)", true],
      [13, ".frontier-crown .ui-popover", true],
      [14, ".frontier-crown > button", true],
    ],
  );
});

test("a class handed to a kit component that draws a surface is a kit surface too, and a none reset wipes it as well", () => {
  const components = kitSurfaceComponents(
    `const Frame = ({ className }) => <section className={cn("ui ui-panel", className)} />;
export const HudPage = (props) => <Frame {...props} />;
export const HudChip = ({ className }) => <span className={cn("ui-chip", className)} />;
`,
    SURFACES,
  );
  assert.deepEqual(
    [...components].map(([name, drawn]) => [name, [...drawn]]),
    [
      ["Frame", ["ui-panel"]],
      ["HudPage", ["ui-panel"]],
    ],
  );
  const companions = surfaceCompanions(
    `<HudPage className="frontier-tray" label="Army" /><HudChip className="frontier-tag" />
<HudPage onClose={() => setOpen(false)} className={cn("frontier-army-panel", open && "is-open")}>x</HudPage>`,
    SURFACES,
    components,
  );
  assert.deepEqual([...companions.keys()], ["frontier-tray", "frontier-army-panel", "is-open"]);
  assert.deepEqual(
    findSurfaceResets(
      `.frontier-tray { background: none; }\n.frontier-tag { background: none; }`,
      "x.css",
      companions,
      SURFACES,
    ).map(({ match }) => match),
    [".frontier-tray"],
  );
});

test("a kit class drawn beside a kit surface is its companion too, so a reset aimed at it is refused", () => {
  const companions = surfaceCompanions(`<button className="ui-popover ui-pick frontier-place" />`, SURFACES);
  assert.deepEqual([...companions.keys()], ["ui-pick", "frontier-place"]);
  assert.deepEqual(
    findSurfaceResets(`.frontier-crown .ui-pick { background: transparent; }`, "x.css", companions, SURFACES).map(
      ({ match }) => match,
    ),
    [".frontier-crown .ui-pick"],
  );
});
