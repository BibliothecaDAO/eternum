import { expect, it } from "vitest";

import { hudScaleFor } from "./hud-scale";

it("draws the HUD at the approved scale for each desktop size, straight between them and never past 2560's", () => {
  expect([1_280, 1_440, 1_920, 2_560, 3_840].map((width) => Math.round(hudScaleFor(width) * 100) / 100)).toEqual([
    0.93, 1, 1, 1.05, 1.05,
  ]);
  expect(hudScaleFor(2_240)).toBeCloseTo(1.025);
  expect(hudScaleFor(800)).toBe(0.71);
});
