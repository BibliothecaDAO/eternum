import { expect, it } from "vitest";

import { hudScaleFor } from "./hud-scale";

it("draws the HUD at its own size at 1920 wide, a third bigger at 2560 and never past its bounds", () => {
  expect([1_440, 1_920, 2_560, 3_840, 1_024].map(hudScaleFor)).toEqual([0.85, 1, 1.33, 1.33, 0.85]);
  expect(hudScaleFor(2_200)).toBeCloseTo(2_200 / 1_920);
});
