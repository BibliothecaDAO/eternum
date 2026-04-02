// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveGameEntryTarget } from "./game-entry-navigation";

describe("resolveGameEntryTarget", () => {
  it("builds a direct player map target from the bootstrapped world-map selection", () => {
    expect(
      resolveGameEntryTarget({
        structureEntityId: 77,
        worldMapReturnPosition: { col: 12, row: 34 },
        isSpectateMode: false,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 77,
      url: "/play/map?col=12&row=34",
      worldMapPosition: { col: 12, row: 34 },
    });
  });

  it("builds a direct spectator map target from the bootstrapped world-map selection", () => {
    expect(
      resolveGameEntryTarget({
        structureEntityId: 91,
        worldMapReturnPosition: { col: 7, row: 9 },
        isSpectateMode: true,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 91,
      url: "/play/map?col=7&row=9&spectate=true",
      worldMapPosition: { col: 7, row: 9 },
    });
  });

  it("returns null when bootstrap did not seed a real structure target", () => {
    expect(
      resolveGameEntryTarget({
        structureEntityId: 0,
        worldMapReturnPosition: null,
        isSpectateMode: false,
      }),
    ).toBeNull();
  });
});
