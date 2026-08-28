import { findCosmeticById } from "@/three/cosmetics/registry";
import { describe, expect, it } from "vitest";

import { PROCEDURAL_MELEE_OFFHANDS, PROCEDURAL_MELEE_WEAPONS } from "./procedural-melee-weapon-catalog";

describe("procedural melee weapon catalog", () => {
  it("resolves every detailed loadout through the central cosmetic registry", () => {
    const registeredDefinitions = [...PROCEDURAL_MELEE_WEAPONS, ...PROCEDURAL_MELEE_OFFHANDS].filter(
      ({ registryEntryId }) => registryEntryId,
    );

    expect(registeredDefinitions.length).toBeGreaterThanOrEqual(5);
    registeredDefinitions.forEach(({ registryEntryId }) => {
      const entry = findCosmeticById(registryEntryId!);
      expect(entry?.category).toBe("attachment");
      expect(entry?.assetPaths[0]).toMatch(/^\/models\/cosmetics\/low-res\/0x[\da-f]+\.glb$/);
      expect(entry?.attachments?.[0]?.mountPoint).toMatch(/^weapon_[lr]$/);
    });
  });
});
