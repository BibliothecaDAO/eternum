import { describe, expect, it } from "vitest";

import { applyProceduralDragonConfigPatch, createDefaultProceduralDragonConfig } from "./procedural-dragon-config";

describe("procedural dragon configuration", () => {
  it("defaults to a landed tier-three dragon and bounds procedural controls", () => {
    const config = applyProceduralDragonConfigPatch(createDefaultProceduralDragonConfig(), {
      altitude: 100,
      fireRange: -1,
      primaryColor: "invalid",
      wingBeatHz: 20,
    });

    expect(config.locomotionMode).toBe("idle");
    expect(config.tier).toBe(3);
    expect(config.altitude).toBe(8);
    expect(config.fireRange).toBe(1);
    expect(config.wingBeatHz).toBe(3);
    expect(config.primaryColor).toBe("#352a32");
  });
});
