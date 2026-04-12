// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveGameEntryTarget } from "./game-entry-navigation";

describe("resolveGameEntryTarget", () => {
  it("keeps player entry on the canonical hex route even when bootstrap seeded a world-map target", () => {
    expect(
      resolveGameEntryTarget({
        chain: "mainnet",
        worldName: "kingdom-1",
        structureEntityId: 77,
        worldMapReturnPosition: { col: 12, row: 34 },
        isSpectateMode: false,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 0,
      url: "/play/mainnet/kingdom-1/hex?col=0&row=0",
      worldMapPosition: null,
    });
  });

  it("builds a canonical spectator map target from the bootstrapped world-map selection", () => {
    expect(
      resolveGameEntryTarget({
        chain: "slot",
        worldName: "blitz-slot-4",
        structureEntityId: 91,
        worldMapReturnPosition: { col: 7, row: 9 },
        isSpectateMode: true,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 91,
      url: "/play/slot/blitz-slot-4/map?col=7&row=9&spectate=true",
      worldMapPosition: { col: 7, row: 9 },
    });
  });

  it("falls back to a canonical hex route when bootstrap did not seed a structure target", () => {
    expect(
      resolveGameEntryTarget({
        chain: "slot",
        worldName: "etrn-sun",
        structureEntityId: 0,
        worldMapReturnPosition: null,
        isSpectateMode: false,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 0,
      url: "/play/slot/etrn-sun/hex?col=0&row=0",
      worldMapPosition: null,
    });
  });

  it("falls back to a canonical spectator map route when no structure target is available", () => {
    expect(
      resolveGameEntryTarget({
        chain: "mainnet",
        worldName: "etrn-dawn",
        structureEntityId: 0,
        worldMapReturnPosition: null,
        isSpectateMode: true,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 0,
      url: "/play/mainnet/etrn-dawn/map?col=0&row=0&spectate=true",
      worldMapPosition: null,
    });
  });
});
