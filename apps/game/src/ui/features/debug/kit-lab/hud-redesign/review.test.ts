import { describe, expect, it } from "vitest";
import rejected from "./rejected-hud-1.json";
import { coveredPixels, judgeHudReview, REFERENCE_FRAMES } from "./review.mjs";

describe("HUD comparison review", () => {
  it("rejects the actual first picker for all six review failures", () => {
    expect(judgeHudReview(rejected)).toEqual([
      "Use the full 1440×900 comparison capture at 1:1 in .map-backdrop; do not crop or zoom it.",
      "Replace visible KitIcon artwork with existing painted images in the HUD picker.",
      "Render HexMinimap on tile fixtures; do not replace the shipped map with a dot grid.",
      "Use the War room primary Button for the one suggestion.",
      "Render the command dock painted art at least 44px.",
      "Reduce visible HUD frames below the current HUD coverage before offering this option.",
    ]);
  });
  it("counts a clipped union once, including fractional frame edges", () => {
    expect(
      coveredPixels(
        [
          { x: -5, y: 0, width: 15, height: 10 },
          { x: 5, y: 5, width: 10, height: 10 },
        ],
        20,
        20,
      ),
    ).toBe(175);
    expect(coveredPixels(REFERENCE_FRAMES.current)).toBe(295184);
    expect(coveredPixels(REFERENCE_FRAMES.warroom)).toBe(392680);
  });
});
