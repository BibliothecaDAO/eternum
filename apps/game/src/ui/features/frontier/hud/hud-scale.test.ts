import { expect, it } from "vitest";

import { hudScaleFor } from "./hud-scale";

const scale = (width: number, height: number) => Math.round(hudScaleFor(width, height) * 100) / 100;

it("fits the six-slot left column by the height, never under the reading floor, on every laptop", () => {
  expect([
    scale(1_260, 735),
    scale(1_280, 720),
    scale(1_366, 768),
    scale(1_440, 900),
    scale(1_536, 864),
    scale(1_920, 1_080),
  ]).toEqual([0.8, 0.8, 0.8, 0.86, 0.82, 1.03]);
});

it("keeps a landscape iPad Pro at the width table's scale, and grows with a big screen", () => {
  expect([scale(1_366, 1_024), scale(1_024, 768)]).toEqual([0.97, 0.71]);
  expect([scale(2_560, 1_440), scale(3_840, 2_160)]).toEqual([1.37, 2.06]);
});

it("lets the height hold a wide screen back", () => {
  expect([scale(2_560, 1_080), scale(3_440, 1_440), scale(1_920, 900)]).toEqual([1.03, 1.37, 0.86]);
});
