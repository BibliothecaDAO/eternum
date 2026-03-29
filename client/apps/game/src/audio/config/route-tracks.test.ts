// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRoutePlaylist } from "./route-tracks";
import { getGameModeId } from "@/config/game-modes";

vi.mock("@/config/game-modes", () => ({
  getGameModeId: vi.fn(),
}));

const mockedGetGameModeId = vi.mocked(getGameModeId);

describe("matchRoutePlaylist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetGameModeId.mockReturnValue("eternum");
  });

  it("prefers landing overview playlist for root path", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/");
    expect(match.key).toBe("landing:overview");
    expect(match.tracks.length).toBeGreaterThan(0);
  });

  it("matches the profile section with nested routes", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/profile/cosmetics");
    expect(match.key).toBe("landing:profile");
  });

  it("matches the profile route with the landing account playlist", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/profile");
    expect(match.key).toBe("landing:profile");
    expect(match.mode).toBe("sequence");
  });

  it("matches the markets route with a trading playlist", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/markets");
    expect(match.key).toBe("landing:markets");
    expect(match.tracks.length).toBeGreaterThan(0);
  });

  it("matches the amm route with a dedicated trading playlist", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/amm");
    expect(match.key).toBe("landing:amm");
    expect(match.tracks.length).toBeGreaterThan(0);
  });

  it("switches to blitz playlist when blitz flag is true", () => {
    mockedGetGameModeId.mockReturnValue("blitz");
    const match = matchRoutePlaylist("/play");
    expect(match.key).toBe("play:blitz");
  });

  it("falls back to main play playlist when not in blitz", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/play/world");
    expect(match.key).toBe("play:main");
  });

  it("always returns a playlist even for unknown routes", () => {
    mockedGetGameModeId.mockReturnValue("eternum");
    const match = matchRoutePlaylist("/unknown/path");
    expect(match.tracks.length).toBeGreaterThan(0);
  });
});
