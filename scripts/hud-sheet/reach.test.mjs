import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { importGraph, isRetired, legacyReached, verdict } from "./reach.mjs";

/** A small app: a window that draws a row through a barrel, the row drawing an old button. */
const FILES = {
  "window.tsx": `import { Row, type RowProps } from "@/parts";\nimport { HudButton } from "./sheet";\nexport const Window = () => <Row />;`,
  "parts/index.ts": `export * from "./row";\nexport { Badge } from "./badge";`,
  "parts/row.tsx": `import Button from "../old-button";\nexport type RowProps = {};\nexport const Row = () => <Button />;`,
  "parts/badge.tsx": `import { Look } from "../old-look";\nexport const Badge = () => <Look />;`,
  "old-button.tsx": `export default function Button() { return <button className="text-gold/70" />; }`,
  "old-look.tsx": `export const Look = () => <i className="bg-black/40" />;`,
  "sheet.tsx": `export const HudButton = () => <button className="ui-button" />;`,
};

const withApp = (run) => {
  const app = mkdtempSync(join(tmpdir(), "hud-reach-"));
  try {
    for (const [path, text] of Object.entries(FILES)) {
      mkdirSync(dirname(join(app, path)), { recursive: true });
      writeFileSync(join(app, path), text);
    }
    run(app);
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
};

const LEGACY = ["old-button.tsx", "old-look.tsx"];

test("an area renders an old look through a child it imports from a barrel, and the walk names the way there", () =>
  withApp((app) => {
    const reached = legacyReached([join(app, "window.tsx")], importGraph(app), (file) =>
      LEGACY.some((path) => file === join(app, path)),
    );
    assert.deepEqual(
      reached.map(({ path }) => path.map((file) => file.slice(app.length + 1))),
      [["window.tsx", "parts/row.tsx", "old-button.tsx"]],
    );
  }));

test("a type, or a barrel's other exports, draw nothing", () =>
  withApp((app) => {
    const edges = importGraph(app)(join(app, "window.tsx")).map((file) => file.slice(app.length + 1));
    assert.deepEqual(edges.sort(), ["parts/row.tsx", "sheet.tsx"]);
  }));

test("an old look fails unless its owner is named, and a named one fails once no area reaches it", () => {
  const reached = { B: [{ file: "old-button.tsx", path: ["window.tsx", "old-button.tsx"] }] };
  const isLegacy = (file) => LEGACY.includes(file);
  assert.deepEqual(verdict(reached, {}, isLegacy), {
    unowned: [{ area: "B", file: "old-button.tsx", path: ["window.tsx", "old-button.tsx"] }],
    stale: [],
  });
  assert.deepEqual(verdict(reached, { "old-button.tsx": "A", "old-look.tsx": "A" }, isLegacy), {
    unowned: [],
    stale: ["old-look.tsx"],
  });
  assert.deepEqual(
    verdict(reached, { "old-button.tsx": "A" }, () => false),
    { unowned: [], stale: ["old-button.tsx"] },
  );
});

test("a control the sheet replaced stays retired however it draws now: every kit component, InfoBubble, the old atoms", () =>
  assert.deepEqual(
    [
      "ui/design-system/atoms/number-input.tsx",
      "ui/design-system/atoms/tab/tab-list.tsx",
      "ui/design-system/kit/sheet.tsx",
      "ui/design-system/kit/tier-chip.tsx",
      "ui/design-system/kit/season-row.tsx",
      "ui/design-system/kit/pill.tsx",
      "ui/design-system/kit/reason-plate.tsx",
      "ui/features/world/components/entities/collapsible-bubble.tsx",
    ].map(isRetired),
    [true, true, true, true, true, true, true, true],
  ));

test("only what the sheet is made of passes in the kit: its elements, the sheet's close behaviour, the tip line, helpers", () =>
  assert.deepEqual(
    [
      "ui/design-system/kit/hud-elements.tsx",
      "ui/design-system/kit/sheet-closes.tsx",
      "ui/design-system/kit/named-tips.tsx",
      "ui/design-system/kit/time.ts",
      "ui/design-system/kit/failure-lines.ts",
      "ui/design-system/kit/price-faces.ts",
      "ui/design-system/atoms/button-group.tsx",
    ].map(isRetired),
    [false, false, false, false, false, false, false],
  ));

test("an area that renders a kit control through another area's child fails, the way there named", () => {
  const app = mkdtempSync(join(tmpdir(), "hud-reach-kit-"));
  try {
    const files = {
      "ui/features/a/window.tsx": `import { Panel } from "@/ui/features/b/panel";\nexport const Window = () => <Panel />;`,
      "ui/features/b/panel.tsx": `import { Pill } from "@/ui/design-system/kit/pill";\nexport const Panel = () => <Pill />;`,
      "ui/design-system/kit/pill.tsx": `export const Pill = () => <span className="ui-pill" />;`,
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(app, path)), { recursive: true });
      writeFileSync(join(app, path), text);
    }
    const reached = legacyReached([join(app, "ui/features/a/window.tsx")], importGraph(app), (file) =>
      isRetired(file.slice(app.length + 1)),
    );
    assert.deepEqual(
      reached.map(({ path }) => path.map((file) => file.slice(app.length + 1))),
      [["ui/features/a/window.tsx", "ui/features/b/panel.tsx", "ui/design-system/kit/pill.tsx"]],
    );
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});
