import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRoutePlaylist } from "./route-tracks";
import { getIsBlitz } from "@bibliothecadao/eternum";

vi.mock("@bibliothecadao/eternum", () => ({
  getIsBlitz: vi.fn(),
}));

const mockedGetIsBlitz = vi.mocked(getIsBlitz);

describe("matchRoutePlaylist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetIsBlitz.mockReturnValue(false);
  });

  it("prefers landing overview playlist for root path", () => {
    mockedGetIsBlitz.mockReturnValue(false);
    const match = matchRoutePlaylist("/");
    expect(match.key).toBe("landing:overview");
    expect(match.tracks.length).toBeGreaterThan(0);
  });

  it("matches cosmetics section with nested routes", () => {
    mockedGetIsBlitz.mockReturnValue(false);
    const match = matchRoutePlaylist("/cosmetics/skins");
    expect(match.key).toBe("landing:cosmetics");
  });

  it("switches to blitz playlist when blitz flag is true", () => {
    mockedGetIsBlitz.mockReturnValue(true);
    const match = matchRoutePlaylist("/play");
    expect(match.key).toBe("play:blitz");
  });

  it("falls back to main play playlist when not in blitz", () => {
    mockedGetIsBlitz.mockReturnValue(false);
    const match = matchRoutePlaylist("/play/world");
    expect(match.key).toBe("play:main");
  });

  it("always returns a playlist even for unknown routes", () => {
    mockedGetIsBlitz.mockReturnValue(false);
    const match = matchRoutePlaylist("/unknown/path");
    expect(match.tracks.length).toBeGreaterThan(0);
  });
});
