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
  chain: "appchain",
  toriiBaseUrl: "https://torii.realms.test",
  worldAddress: "0x1",
  contractsBySelector: {},
  fetchedAt: 0,
};

describe("play-route", () => {
  it("parses a canonical play route descriptor from the URL", () => {
    expect(parsePlayRoute(createLocation("/play/appchain/aurora-blitz/map", "?col=12&row=34&spectate=true"))).toEqual({
      chain: "appchain",
      worldName: "aurora-blitz",
      scene: "map",
      col: 12,
      row: 34,
      spectate: true,
      bootMode: "direct",
      resumeScene: null,
    });
  });

  it("builds a canonical play href from a descriptor", () => {
    expect(
      buildPlayHref({
        chain: "madara",
        worldName: "iron-age",
        scene: "travel",
        col: 7,
        row: 9,
        spectate: false,
      }),
    ).toBe("/play/madara/iron-age/travel?col=7&row=9");
  });

  it("parses and builds canonical entry routes", () => {
    const route = parseEntryRoute(createLocation("/enter/appchain/aurora-blitz", "?intent=settle&autoSettle=true"));

    expect(route).toEqual({
      chain: "appchain",
      worldName: "aurora-blitz",
      intent: "settle",
      autoSettle: true,
    });

    expect(buildEntryHref(route!)).toBe("/enter/appchain/aurora-blitz?intent=settle&autoSettle=true");
  });

  it("normalizes legacy scene routes into canonical play URLs when a fallback world exists", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/play/map", "?col=1&row=2&spectate=true"), FALLBACK_WORLD)).toBe(
      "/play/appchain/aurora-blitz/map?col=1&row=2&spectate=true",
    );
  });

  it("normalizes bare scene routes emitted by legacy helpers into canonical play URLs", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/hex", "?col=4&row=9"), FALLBACK_WORLD)).toBe(
      "/play/appchain/aurora-blitz/hex?col=4&row=9",
    );
  });

  it("normalizes legacy world routes into canonical map routes when a fallback chain exists", () => {
    expect(normalizeLegacyPlayLocation(createLocation("/play/iron-age"), FALLBACK_WORLD)).toBe(
      "/play/appchain/iron-age/map",
    );
  });
});
