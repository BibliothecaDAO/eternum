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
    mockedGetGameModeId.mockReturnValue("standard");
  });

  it("prefers landing overview playlist for root path", () => {
    mockedGetGameModeId.mockReturnValue("standard");
    const match = matchRoutePlaylist("/");
    expect(match.key).toBe("landing:overview");
    expect(match.tracks.length).toBeGreaterThan(0);
  });

  it("matches cosmetics section with nested routes", () => {
    mockedGetGameModeId.mockReturnValue("standard");
    const match = matchRoutePlaylist("/cosmetics/skins");
    expect(match.key).toBe("landing:cosmetics");
  });

  it("switches to blitz playlist when blitz flag is true", () => {
    mockedGetGameModeId.mockReturnValue("blitz");
    const match = matchRoutePlaylist("/play");
    expect(match.key).toBe("play:blitz");
  });

  it("falls back to main play playlist when not in blitz", () => {
    mockedGetGameModeId.mockReturnValue("standard");
    const match = matchRoutePlaylist("/play/world");
    expect(match.key).toBe("play:main");
  });

  it("always returns a playlist even for unknown routes", () => {
    mockedGetGameModeId.mockReturnValue("standard");
    const match = matchRoutePlaylist("/unknown/path");
    expect(match.tracks.length).toBeGreaterThan(0);
  });
});
