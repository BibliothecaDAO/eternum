// @vitest-environment node

import { configManager } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { resolveGameEntryTarget } from "./game-entry-navigation";

configManager.mapCenter = 2010831280;

describe("resolveGameEntryTarget", () => {
  it("routes player entry through the bootstrapped world-map target when one is available", () => {
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
      structureEntityId: 77,
      url: "/play/mainnet/kingdom-1/map?col=12&row=34",
      worldMapPosition: { col: 12, row: 34 },
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

  it("normalizes contract-space world-map selections before building a canonical dashboard entry URL", () => {
    const result = resolveGameEntryTarget({
      chain: "slot",
      worldName: "bltz-spark-702",
      structureEntityId: 91,
      worldMapReturnPosition: { col: 2010831286, row: 2010831278 },
      isSpectateMode: false,
      mapCenterOffset: 136652366,
    });

    expect(result).toEqual({
      spectator: false,
      structureEntityId: 91,
      url: "/play/slot/bltz-spark-702/map?col=6&row=-2",
      worldMapPosition: {
        col: 6,
        row: -2,
      },
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
