// @vitest-environment node

import { configManager, Position } from "@bibliothecadao/eternum";
import { mapRouteHex } from "@/play/navigation/play-route";
import { describe, expect, it, vi } from "vitest";

import { resolveGameEntryTarget } from "./game-entry-navigation";

vi.spyOn(configManager, "getMapCenter").mockReturnValue(2010831280);

describe("resolveGameEntryTarget", () => {
  it("routes player entry through the bootstrapped world-map target when one is available", () => {
    expect(
      resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 3,
        structureEntityId: 77,
        worldMapReturnPosition: { col: 12, row: 34 },
        isSpectateMode: false,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 77,
      url: "/g/0xa1/3/map?col=12&row=34",
      worldMapPosition: { col: 12, row: 34 },
    });
  });

  it("builds a canonical spectator map target from the bootstrapped world-map selection", () => {
    expect(
      resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 3,
        structureEntityId: 91,
        worldMapReturnPosition: { col: 7, row: 9 },
        isSpectateMode: true,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 91,
      url: "/g/0xa1/3/map?col=7&row=9&spectate=true",
      worldMapPosition: { col: 7, row: 9 },
    });
  });

  it("opens a Frontier player's session on the map at their realm's normalized site, as every mode does", () => {
    const site = Position.fromContract({ x: 13850, y: 19650 });
    const enter = (isSpectateMode: boolean) =>
      resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 1,
        structureEntityId: 139,
        worldMapReturnPosition: mapRouteHex(site),
        isSpectateMode,
      });

    const normalized = { col: 13850 - 2010831280, row: 19650 - 2010831280 };
    expect(enter(false)).toEqual({
      spectator: false,
      structureEntityId: 139,
      url: `/g/0xa1/1/map?col=${normalized.col}&row=${normalized.row}`,
      worldMapPosition: normalized,
    });
    expect(enter(true).url).toBe(`/g/0xa1/1/map?col=${normalized.col}&row=${normalized.row}&spectate=true`);
  });

  it("carries the renderer request the entry was opened with to the map, where the renderer reads it", () => {
    const url = resolveGameEntryTarget({
      chainId: "0xa1",
      gameId: 3,
      structureEntityId: 0,
      worldMapReturnPosition: null,
      isSpectateMode: true,
      renderer: { rendererMode: "webgpu-force-webgl", verboseLogs: true },
    }).url;
    expect(url).toBe("/g/0xa1/3/map?spectate=true&rendererMode=webgpu-force-webgl&logs=1");
  });

  it("falls back to a canonical map route when bootstrap did not seed a structure target", () => {
    expect(
      resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 3,
        structureEntityId: 0,
        worldMapReturnPosition: null,
        isSpectateMode: false,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 0,
      url: "/g/0xa1/3/map",
      worldMapPosition: null,
    });
  });

  it("falls back to a canonical spectator map route when no structure target is available", () => {
    expect(
      resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 3,
        structureEntityId: 0,
        worldMapReturnPosition: null,
        isSpectateMode: true,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 0,
      url: "/g/0xa1/3/map?spectate=true",
      worldMapPosition: null,
    });
  });
});
