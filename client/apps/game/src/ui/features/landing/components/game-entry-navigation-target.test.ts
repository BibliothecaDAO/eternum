import { describe, expect, it } from "vitest";

import { resolveGameEntryNavigationTarget } from "./game-entry-navigation-target";

describe("resolveGameEntryNavigationTarget", () => {
  it("keeps the player entry placeholder flow for non-spectators", () => {
    expect(
      resolveGameEntryNavigationTarget({
        isSpectateMode: false,
        structureEntityId: 321,
        worldMapReturnPosition: { col: 12, row: 34 },
      }),
    ).toEqual({
      structureEntityId: 0,
      worldMapPosition: { col: 0, row: 0 },
      url: "/play/hex?col=0&row=0",
    });
  });

  it("uses the resolved spectator world-map target when available", () => {
    expect(
      resolveGameEntryNavigationTarget({
        isSpectateMode: true,
        structureEntityId: 777,
        resolvedStructurePosition: { col: -21, row: -4 },
        worldMapReturnPosition: { col: -21, row: -4 },
      }),
    ).toEqual({
      structureEntityId: 777,
      worldMapPosition: { col: -21, row: -4 },
      url: "/play/map?col=-21&row=-4&spectate=true",
    });
  });

  it("prefers a resolved structure position over the stored fallback position", () => {
    expect(
      resolveGameEntryNavigationTarget({
        isSpectateMode: true,
        structureEntityId: 777,
        resolvedStructurePosition: { col: -21, row: -4 },
        worldMapReturnPosition: { col: 0, row: 0 },
      }),
    ).toEqual({
      structureEntityId: 777,
      worldMapPosition: { col: -21, row: -4 },
      url: "/play/map?col=-21&row=-4&spectate=true",
    });
  });

  it("falls back to the origin when no spectator target is known yet", () => {
    expect(
      resolveGameEntryNavigationTarget({
        isSpectateMode: true,
        structureEntityId: 0,
        worldMapReturnPosition: null,
      }),
    ).toEqual({
      structureEntityId: 0,
      worldMapPosition: { col: 0, row: 0 },
      url: "/play/map?col=0&row=0&spectate=true",
    });
  });

  it("ignores absurd spectator fallback coordinates from sync state", () => {
    expect(
      resolveGameEntryNavigationTarget({
        isSpectateMode: true,
        structureEntityId: 777,
        worldMapReturnPosition: { col: 1679904875, row: 1679904892 },
      }),
    ).toEqual({
      structureEntityId: 777,
      worldMapPosition: { col: 0, row: 0 },
      url: "/play/map?col=0&row=0&spectate=true",
    });
  });
});
