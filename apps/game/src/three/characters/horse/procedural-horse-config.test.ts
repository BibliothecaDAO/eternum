import { describe, expect, it, vi } from "vitest";

import { applyProceduralHorseConfigPatch, createDefaultProceduralHorseConfig } from "./procedural-horse-config";

describe("procedural horse configuration", () => {
  it("bounds organic gait controls at the configuration seam", () => {
    const config = applyProceduralHorseConfigPatch(createDefaultProceduralHorseConfig(), {
      diagonalDissociation: 1,
      hoofPlant: -1,
      motionVariation: 3,
      secondaryMotion: 4,
      seed: -10,
      terrainResponse: 2,
    });

    expect(config.diagonalDissociation).toBe(0.04);
    expect(config.hoofPlant).toBe(0);
    expect(config.motionVariation).toBe(0.3);
    expect(config.secondaryMotion).toBe(1.5);
    expect(config.seed).toBe(0);
    expect(config.terrainResponse).toBe(1);
  });

  it("normalizes persisted appearance ids at the configuration seam", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const config = applyProceduralHorseConfigPatch(createDefaultProceduralHorseConfig(), {
      appearanceId: "missing" as never,
    });

    expect(config.appearanceId).toBe("quaternius");
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
