import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID,
  PROCEDURAL_HORSE_APPEARANCES,
  normalizeProceduralHorseAppearanceId,
  resolveProceduralHorseAppearance,
  resolveProceduralHorseAppearanceAssetId,
} from "./procedural-horse-appearance";

describe("procedural horse appearances", () => {
  it("keeps model family independent from upgrade tier", () => {
    expect(resolveProceduralHorseAppearanceAssetId("quaternius", 1)).toBe("quaternius-horse");
    expect(resolveProceduralHorseAppearanceAssetId("quaternius", 2)).toBe("quaternius-horse");
    expect(resolveProceduralHorseAppearanceAssetId("quaternius", 3)).toBe("quaternius-horse");
    expect(resolveProceduralHorseAppearance("quaternius").rigAdapterId).toBe("quaternius-horse");
  });

  it("publishes selectable labels and loudly normalizes unknown persisted values", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(PROCEDURAL_HORSE_APPEARANCES.map(({ id }) => id)).toEqual(["quaternius"]);
    expect(resolveProceduralHorseAppearance("quaternius").label).toBe("Quaternius Animated Animal");
    expect(normalizeProceduralHorseAppearanceId("unknown-family")).toBe(DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID);
    expect(normalizeProceduralHorseAppearanceId("toString")).toBe(DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID);
    expect(warning).toHaveBeenCalledWith('Unknown procedural horse appearance "unknown-family"; using "quaternius"');
    warning.mockRestore();
  });
});
