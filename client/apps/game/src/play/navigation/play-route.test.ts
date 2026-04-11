import type { WorldProfile } from "@/runtime/world/types";
import { describe, expect, it } from "vitest";

import {
  buildEntryHref,
  buildPlayHref,
  normalizeLegacyPlayLocation,
  parseEntryRoute,
  parsePlayRoute,
} from "./play-route";

const createLocation = (pathname: string, search = ""): Location => ({ pathname, search }) as Location;

const FALLBACK_WORLD: WorldProfile = {
  name: "aurora-blitz",
  chain: "sepolia",
  toriiBaseUrl: "https://api.cartridge.gg/x/aurora-blitz/torii",
  worldAddress: "0x1",
  contractsBySelector: {},
  fetchedAt: 0,
};

describe("play-route", () => {
  it("parses a canonical play route descriptor from the URL", () => {
    expect(parsePlayRoute(createLocation("/play/sepolia/aurora-blitz/map", "?col=12&row=34&spectate=true"))).toEqual({
      chain: "sepolia",
      worldName: "aurora-blitz",
      scene: "map",
      col: 12,
      row: 34,
      spectate: true,
    });
  });

  it("builds a canonical play href from a descriptor", () => {
    expect(
      buildPlayHref({
        chain: "mainnet",
        worldName: "iron-age",
        scene: "travel",
        col: 7,
        row: 9,
        spectate: false,
      }),
    ).toBe("/play/mainnet/iron-age/travel?col=7&row=9");
  });

  it("parses and builds canonical entry routes", () => {
    const route = parseEntryRoute(createLocation("/enter/sepolia/aurora-blitz", "?intent=forge&hyperstructuresLeft=3"));

    expect(route).toEqual({
      chain: "sepolia",
      worldName: "aurora-blitz",
      intent: "forge",
      hyperstructuresLeft: 3,
    });

    expect(buildEntryHref(route!)).toBe("/enter/sepolia/aurora-blitz?intent=forge&hyperstructuresLeft=3");
  });

  it("normalizes legacy scene routes into canonical play URLs when a fallback world exists", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/play/map", "?col=1&row=2&spectate=true"), FALLBACK_WORLD)).toBe(
      "/play/sepolia/aurora-blitz/map?col=1&row=2&spectate=true",
    );
  });

  it("normalizes bare scene routes emitted by legacy helpers into canonical play URLs", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/hex", "?col=4&row=9"), FALLBACK_WORLD)).toBe(
      "/play/sepolia/aurora-blitz/hex?col=4&row=9",
    );
  });

  it("normalizes legacy world routes into canonical map routes when a fallback chain exists", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/play/iron-age"), FALLBACK_WORLD)).toBe(
      "/play/sepolia/iron-age/map",
    );
  });
});
