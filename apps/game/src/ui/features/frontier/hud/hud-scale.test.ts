import { expect, it } from "vitest";

import { hudScaleFor } from "./hud-scale";

it("draws the HUD at the approved scale for each desktop size, straight between them and never past 2560's", () => {
  expect([1_280, 1_440, 1_920, 2_560, 3_840].map((width) => Math.round(hudScaleFor(width) * 100) / 100)).toEqual([
    0.89, 1, 1.12, 1.35, 1.35,
  ]);
  expect(hudScaleFor(1_680)).toBeCloseTo(1.06);
  expect(hudScaleFor(800)).toBe(0.71);
});
