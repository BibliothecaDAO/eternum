import { describe, expect, it } from "vitest";

import {
  applyDefaultMeleeLoadoutForKind,
  applyProceduralMeleeConfigPatch,
  createDefaultProceduralMeleeConfig,
} from "./procedural-melee-config";

describe("procedural melee configuration", () => {
  it("normalizes animation, reach, and target controls", () => {
    const config = applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig(), {
      attackArcDegrees: 999,
      reach: 0,
      strikeSeconds: -1,
      targetDistance: 20,
      torsoWeight: 2,
    });

    expect(config.attackArcDegrees).toBe(220);
    expect(config.reach).toBe(0.6);
    expect(config.strikeSeconds).toBe(0.05);
    expect(config.targetDistance).toBe(3);
    expect(config.torsoWeight).toBe(1);
  });

  it("resolves domain defaults when switching between foot and mounted melee units", () => {
    const knight = applyDefaultMeleeLoadoutForKind(createDefaultProceduralMeleeConfig("paladin"), "knight");
    const paladin = applyDefaultMeleeLoadoutForKind(knight, "paladin");

    expect(knight.weaponId).toBe("iron-longsword");
    expect(paladin.weaponId).toBe("runic-warhammer");
  });
});
