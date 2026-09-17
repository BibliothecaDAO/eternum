// @vitest-environment node

import { describe, expect, it } from "vitest";
import { matchRoutePlaylist } from "./route-tracks";
describe("matchRoutePlaylist", () => {
  it("prefers landing overview playlist for root path", () => {
    const match = matchRoutePlaylist("/");
    expect(match.key).toBe("landing:overview");
    expect(match.tracks.length).toBeGreaterThan(0);
    expect(match.tracks).toContain("music.birds_paradise");
  });

  it("matches the markets route with a trading playlist", () => {
    const match = matchRoutePlaylist("/markets");
    expect(match.key).toBe("landing:markets");
    expect(match.tracks.length).toBeGreaterThan(0);
    expect(match.tracks).toContain("music.bumu_bun");
  });

  it("matches the amm route with a dedicated trading playlist", () => {
    const match = matchRoutePlaylist("/amm");
    expect(match.key).toBe("landing:amm");
    expect(match.tracks.length).toBeGreaterThan(0);
    expect(match.tracks).toContain("music.monophonic_mixtape_13");
  });

  it("switches to blitz playlist when blitz flag is true", () => {
    const match = matchRoutePlaylist("/play", { modeId: "blitz" });
    expect(match.key).toBe("play:blitz");
    expect(match.mode).toBe("shuffle");
    expect(match.tracks).toEqual([
      "music.monophonic_mixtape_09",
      "music.monophonic_mixtape_10",
      "music.cha_cha_chi",
      "music.monophonic_mixtape_11",
      "music.monophonic_mixtape_12",
      "music.monophonic_mixtape_13",
      "music.monophonic_mixtape_14",
    ]);
  });

  it("falls back to main play playlist when not in blitz", () => {
    const match = matchRoutePlaylist("/play/world", { modeId: "eternum" });
    expect(match.key).toBe("play:main");
    expect(match.tracks).toContain("music.cha_cha_chi");
    expect(match.tracks).toContain("music.monophonic_mixtape_14");
  });

  it("always returns a playlist even for unknown routes", () => {
    const match = matchRoutePlaylist("/unknown/path");
    expect(match.tracks.length).toBeGreaterThan(0);
  });
});
