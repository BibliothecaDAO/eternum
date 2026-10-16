// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { CameraView } from "../../scenes/camera-view";
import { createGuardArmyDisplay, createProductionDisplay, createStaminaBar } from "./label-components";

const guards = (count: number) =>
  Array.from({ length: count }, (_, slot) => ({ slot, category: "Knight", tier: 1, count: 100 }));

describe("map label parts", () => {
  it("says a structure has no guards", () => {
    expect(createGuardArmyDisplay([], CameraView.Far).textContent).toBe("No Guards");
  });

  it("totals twelve guards in the far view", () => {
    const total = createGuardArmyDisplay(guards(12), CameraView.Far).querySelector('[data-role="total-guards"]');
    expect(total?.textContent).toContain("Total");
    expect(total?.querySelector('[data-role="count"]')?.textContent).toBe((1_200).toLocaleString());
  });

  it("says a structure produces nothing", () => {
    expect(createProductionDisplay([], CameraView.Far).textContent).toBe("No Active Production");
  });

  it("shows an army's stamina against its maximum", () => {
    const text = createStaminaBar(60, 120, CameraView.Medium).querySelector('[data-role="stamina-text"]');
    expect(text?.textContent).toBe("60/120");
  });
});
