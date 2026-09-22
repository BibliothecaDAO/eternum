import type { GameProfile } from "@/runtime/world/types";
import { describe, expect, it } from "vitest";

import {
  buildEntryHref,
  buildPlayHref,
  normalizeLegacyPlayLocation,
  parseEntryRoute,
  parsePlayRoute,
} from "./play-route";

const createLocation = (pathname: string, search = ""): Location => ({ pathname, search }) as Location;

const FALLBACK_WORLD: GameProfile = { chainId: "0xa1", gameId: 3, presetId: 2, name: "aurora-blitz", fetchedAt: 0 };

describe("play-route", () => {
  it("parses a canonical play route descriptor from the URL", () => {
    expect(parsePlayRoute(createLocation("/play/0xA1/3/map", "?col=12&row=34&spectate=true"))).toEqual({
      chainId: "0xa1",
      gameId: 3,
      scene: "map",
      col: 12,
      row: 34,
      bootMode: "direct",
      resumeScene: null,
    });
  });

  it("builds a canonical play href from a descriptor", () => {
    expect(
      buildPlayHref({
        chainId: "0xb2",
        gameId: 9,
        scene: "hex",
        col: 7,
        row: 9,
      }),
    ).toBe("/play/0xb2/9/hex?col=7&row=9");
  });

  it("retains renderer diagnostics when switching scenes and finishing the loading handoff", () => {
    const route = parsePlayRoute(
      createLocation(
        "/play/0xb2/9/map",
        "?col=1&row=2&boot=map-first&resumeScene=hex&rendererMode=webgpu-force-webgl&logs=1",
      ),
    )!;
    expect(buildPlayHref({ ...route, scene: "hex", bootMode: "direct", resumeScene: null, spectate: false })).toBe(
      "/play/0xb2/9/hex?col=1&row=2&rendererMode=webgpu-force-webgl&logs=1",
    );
  });

  it("parses and builds canonical entry routes", () => {
    const route = parseEntryRoute(createLocation("/enter/0xa1/3", "?intent=settle&autoSettle=true"));

    expect(route).toEqual({
      chainId: "0xa1",
      gameId: 3,
      intent: "settle",
      autoSettle: true,
    });

    expect(buildEntryHref(route!)).toBe("/enter/0xa1/3?intent=settle&autoSettle=true");
  });

  it("normalizes legacy scene routes into canonical play URLs when a fallback world exists", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/play/map", "?col=1&row=2&spectate=true"), FALLBACK_WORLD)).toBe(
      "/play/0xa1/3/map?col=1&row=2&spectate=true",
    );
  });

  it("normalizes bare scene routes emitted by legacy helpers into canonical play URLs", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/hex", "?col=4&row=9"), FALLBACK_WORLD)).toBe(
      "/play/0xa1/3/hex?col=4&row=9",
    );
  });
});
