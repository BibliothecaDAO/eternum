import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID,
  PROCEDURAL_CHARACTER_APPEARANCES,
  doesProceduralCharacterRenderDetailChangeAsset,
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
    expect(resolveProceduralCharacterAppearanceAssetId("t1-knight-default", 1)).toBe("t1-knight-default-near");
    expect(resolveProceduralCharacterAppearanceAssetId("t1-knight-default", 1, "crowd")).toBe("t1-knight-default-mid");
  });

  it("publishes selectable labels and loudly normalizes unknown persisted values", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(PROCEDURAL_CHARACTER_APPEARANCES.map(({ id }) => id)).toEqual([
      "t1-knight-default",
      "modular-fantasy",
      "universal-base",
    ]);
    expect(resolveProceduralCharacterAppearance("t1-knight-default").compatibleKinds).toEqual(["knight"]);
    expect(resolveProceduralCharacterAppearance("universal-base").label).toBe("Universal base body");
    expect(resolveProceduralCharacterAppearance("t1-knight-default").materials).toEqual({ authoredSource: true });
    expect(resolveProceduralCharacterAppearance("modular-fantasy").materials).toMatchObject({
      outfit: /ranger|peasant/i,
    });
    expect(normalizeProceduralCharacterAppearanceId("unknown-family")).toBe(DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID);
    expect(normalizeProceduralCharacterAppearanceId("toString")).toBe(DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID);
    expect(warning).toHaveBeenCalledWith(
      'Unknown procedural character appearance "unknown-family"; using "modular-fantasy"',
    );
    warning.mockRestore();
  });

  it("changes models for authored LODs without rebuilding legacy appearances", () => {
    expect(doesProceduralCharacterRenderDetailChangeAsset("modular-fantasy", 1, "hero", "crowd")).toBe(false);
    expect(doesProceduralCharacterRenderDetailChangeAsset("t1-knight-default", 1, "hero", "crowd")).toBe(true);
  });
});
