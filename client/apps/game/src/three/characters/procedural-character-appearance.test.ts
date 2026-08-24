import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID,
  PROCEDURAL_CHARACTER_APPEARANCES,
  normalizeProceduralCharacterAppearanceId,
  resolveProceduralCharacterAppearance,
  resolveProceduralCharacterAppearanceAssetId,
} from "./procedural-character-appearance";

describe("procedural character appearances", () => {
  it("keeps model family independent from upgrade tier", () => {
    expect(resolveProceduralCharacterAppearanceAssetId("modular-fantasy", 1)).toBe("base");
    expect(resolveProceduralCharacterAppearanceAssetId("modular-fantasy", 2)).toBe("peasant");
    expect(resolveProceduralCharacterAppearanceAssetId("modular-fantasy", 3)).toBe("ranger");
    expect(resolveProceduralCharacterAppearanceAssetId("universal-base", 3)).toBe("base");
  });

  it("publishes selectable labels and loudly normalizes unknown persisted values", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(PROCEDURAL_CHARACTER_APPEARANCES.map(({ id }) => id)).toEqual(["modular-fantasy", "universal-base"]);
    expect(resolveProceduralCharacterAppearance("universal-base").label).toBe("Universal base body");
    expect(resolveProceduralCharacterAppearance("modular-fantasy").materials.outfit.test("MI_Ranger_Armor")).toBe(true);
    expect(normalizeProceduralCharacterAppearanceId("unknown-family")).toBe(DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID);
    expect(normalizeProceduralCharacterAppearanceId("toString")).toBe(DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID);
    expect(warning).toHaveBeenCalledWith(
      'Unknown procedural character appearance "unknown-family"; using "modular-fantasy"',
    );
    warning.mockRestore();
  });
});
