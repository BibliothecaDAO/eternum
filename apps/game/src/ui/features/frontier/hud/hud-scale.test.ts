import { expect, it } from "vitest";

import { hudScaleFor } from "./hud-scale";

const scale = (width: number, height: number) => Math.round(hudScaleFor(width, height) * 100) / 100;

it("fits the left column's tallest state at every laptop size, the smaller of the width and height scales", () => {
  expect([scale(1_260, 735), scale(1_280, 720), scale(1_280, 800), scale(1_366, 768), scale(1_440, 900)]).toEqual([
    0.77, 0.75, 0.83, 0.8, 0.94,
  ]);
});

it("keeps a landscape iPad Pro at the width table's scale, and grows with a big screen", () => {
  expect([scale(1_366, 1_024), scale(1_024, 768)]).toEqual([0.97, 0.71]);
  expect([scale(1_920, 1_080), scale(2_560, 1_440), scale(3_840, 2_160)]).toEqual([1.13, 1.5, 2.25]);
});

it("lets the height hold a wide screen back", () => {
  expect([scale(2_560, 1_080), scale(3_440, 1_440), scale(1_920, 900)]).toEqual([1.13, 1.5, 0.94]);
});
