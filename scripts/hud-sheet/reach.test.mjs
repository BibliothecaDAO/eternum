import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { importGraph, legacyReached, verdict } from "./reach.mjs";

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
