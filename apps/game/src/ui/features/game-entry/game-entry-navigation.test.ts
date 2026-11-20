// @vitest-environment node

import { configManager, Position } from "@bibliothecadao/eternum";
import { buildEntryHref, mapRouteHex, parseRendererOptions } from "@/play/navigation/play-route";
import { describe, expect, it, vi } from "vitest";

import { resolveGameEntryTarget } from "./game-entry-navigation";

vi.spyOn(configManager, "getMapCenter").mockReturnValue(2010831280);

describe("resolveGameEntryTarget", () => {
  it.each(["play", "spectate"] as const)("carries a renderer trial from the home page through %s entry", (intent) => {
    vi.stubGlobal("location", { pathname: "/", search: "?rendererMode=webgpu-force-webgl&logs=1&dev=0" });
    try {
      const href = buildEntryHref({ chainId: "0xa1", gameId: 3, intent, autoSettle: false });
      expect(href).toBe(
        `/g/0xa1/3?${intent === "spectate" ? "spectate=true&" : ""}rendererMode=webgpu-force-webgl&logs=1`,
      );
      const target = resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 3,
        structureEntityId: 0,
        worldMapReturnPosition: null,
        isSpectateMode: intent === "spectate",
        realmFirst: false,
        renderer: parseRendererOptions(new URL(href, "https://game.test").searchParams),
      });
      expect(target.url).toBe(
        `/g/0xa1/3/map?${intent === "spectate" ? "spectate=true&" : ""}rendererMode=webgpu-force-webgl&logs=1`,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes player entry through the bootstrapped world-map target when one is available", () => {
    expect(
      resolveGameEntryTarget({
        chainId: "0xa1",
        gameId: 3,
        structureEntityId: 77,
        worldMapReturnPosition: { col: 12, row: 34 },
        isSpectateMode: false,
        realmFirst: false,
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
        realmFirst: false,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 91,
      url: "/g/0xa1/3/map?col=7&row=9&spectate=true",
      worldMapPosition: { col: 7, row: 9 },
    });
  });

  const site = Position.fromContract({ x: 13850, y: 19650 });
  const normalizedSite = { col: 13850 - 2010831280, row: 19650 - 2010831280 };
  const enterFrontier = (isSpectateMode: boolean, realmFirst = false) =>
    resolveGameEntryTarget({
      chainId: "0xa1",
      gameId: 1,
      structureEntityId: 139,
      worldMapReturnPosition: mapRouteHex(site),
      isSpectateMode,
      realmFirst,
    });

  it("opens a returning Frontier player's session on the map at their realm's normalized site, as every mode does", () => {
    const enter = (isSpectateMode: boolean) => enterFrontier(isSpectateMode);

    const normalized = { col: 13850 - 2010831280, row: 19650 - 2010831280 };
    expect(enter(false)).toEqual({
      spectator: false,
      structureEntityId: 139,
      url: `/g/0xa1/1/map?col=${normalized.col}&row=${normalized.row}`,
      worldMapPosition: normalized,
    });
    expect(enter(true).url).toBe(`/g/0xa1/1/map?col=${normalized.col}&row=${normalized.row}&spectate=true`);
  });

  it("brings a player who has just created their realm into it: the map boots, then hands off to the realm", () => {
    const { col, row } = normalizedSite;
    expect(enterFrontier(false, true).url).toBe(`/g/0xa1/1/map?col=${col}&row=${row}&boot=map-first&resumeScene=hex`);
    // A spectator never arrives in a realm.
    expect(enterFrontier(true, true).url).toBe(`/g/0xa1/1/map?col=${col}&row=${row}&spectate=true`);
  });

  it("hands a just-created realm's entry off to the realm even before the entry knows where it stands", () => {
    const url = resolveGameEntryTarget({
      chainId: "0xa1",
      gameId: 1,
      structureEntityId: 0,
      worldMapReturnPosition: null,
      isSpectateMode: false,
      realmFirst: true,
    }).url;
    expect(url).toBe("/g/0xa1/1/map?boot=map-first&resumeScene=hex");
  });

  it("carries the renderer request the entry was opened with to the map, where the renderer reads it", () => {
    const url = resolveGameEntryTarget({
      chainId: "0xa1",
      gameId: 3,
      structureEntityId: 0,
      worldMapReturnPosition: null,
      isSpectateMode: true,
      realmFirst: false,
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
        realmFirst: false,
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
        realmFirst: false,
      }),
    ).toEqual({
      spectator: true,
      structureEntityId: 0,
      url: "/g/0xa1/3/map?spectate=true",
      worldMapPosition: null,
    });
  });
});
