import { expect, it } from "vitest";

import { hudScaleFor } from "./hud-scale";

const scale = (width: number, height: number) => Math.round(hudScaleFor(width, height) * 100) / 100;

it("keeps the approved scale up to 1440 and grows with the screen past it, as 1440 x 900 is drawn", () => {
  expect([scale(1_024, 768), scale(1_280, 720), scale(1_440, 900)]).toEqual([0.71, 0.93, 1]);
  expect([scale(1_920, 1_080), scale(2_560, 1_440), scale(3_840, 2_160)]).toEqual([1.2, 1.6, 2.4]);
});

it("lets the height hold a wide screen back, so a short one keeps the HUD whole", () => {
  expect([scale(2_560, 1_080), scale(3_440, 1_440), scale(1_920, 900)]).toEqual([1.2, 1.6, 1]);
});
