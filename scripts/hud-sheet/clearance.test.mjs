import assert from "node:assert/strict";
import { test } from "node:test";

import { hudClearanceProblems } from "./clearance.mjs";

const box = (name, left, top, right, bottom) => ({ name, left, top, right, bottom });

/** The lab's left column and foot as a browser measured them (evidence/rings/minimap-pin-1). */
const hud = ({ width, height, minimapTop, minimapBottom, foot }) => ({
  viewport: { width, height },
  column: box("Holdings", 12, 60, 332, height - 16),
  panels: [
    box("section", 12, 60, 332, 175),
    box("Selected holding", 12, 183, 332, 356),
    box("Minimap", 12, minimapTop, 332, minimapBottom),
  ],
  foot,
});

test("passes a minimap in the column's corner and a foot between the columns", () => {
  const pinned = hud({
    width: 1440,
    height: 900,
    minimapTop: 564,
    minimapBottom: 884,
    foot: [box("div", 493, 812, 826, 880), box("div", 842, 816, 947, 852)],
  });
  assert.deepEqual(hudClearanceProblems(pinned), []);
});

test("finds a minimap left floating under the card, short of the corner", () => {
  const floating = hud({ width: 1920, height: 1080, minimapTop: 364, minimapBottom: 684, foot: [] });
  assert.deepEqual(hudClearanceProblems(floating), [
    "the minimap's corner (12, 684) is not the column's bottom-left (12, 1064)",
  ]);
});

test("finds the foot's bubbles spilling over the column on a narrow desktop", () => {
  const spilling = hud({
    width: 1024,
    height: 600,
    minimapTop: 364,
    minimapBottom: 584,
    foot: [box("div", 285, 512, 618, 580), box("div", 634, 516, 739, 552)],
  });
  assert.deepEqual(hudClearanceProblems(spilling), [
    "the foot's div (285–618) leaves the room between the columns (332–692)",
    "the foot's div (634–739) leaves the room between the columns (332–692)",
  ]);
});

test("finds a panel running into the minimap", () => {
  const crowded = hud({ width: 1280, height: 720, minimapTop: 340, minimapBottom: 704, foot: [] });
  assert.deepEqual(hudClearanceProblems(crowded), ["Selected holding overlaps Minimap"]);
});
