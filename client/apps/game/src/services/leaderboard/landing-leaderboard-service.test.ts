// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveGameRuntimeEndpointMock = vi.fn<() => string>();

vi.mock("@/config/runtime-endpoints", () => ({
  resolveGameRuntimeEndpoint: resolveGameRuntimeEndpointMock,
}));

describe("score-to-beat endpoint resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    resolveGameRuntimeEndpointMock.mockReset();
  });

  it("imports without resolving active endpoints and keeps archives on explicit read-only Slot endpoints", async () => {
    resolveGameRuntimeEndpointMock.mockImplementation(() => {
      throw new Error("active endpoint resolution must be lazy");
    });

    const { resolveScoreToBeatGameEndpoint, SCORE_TO_BEAT_STATIC_GAMES } =
      await import("./landing-leaderboard-service");

    expect(resolveGameRuntimeEndpointMock).not.toHaveBeenCalled();
    expect(resolveScoreToBeatGameEndpoint("s0-game-1", "mainnet")).toBe(
      "https://api.cartridge.gg/x/s0-game-1/torii/sql",
    );
    expect(SCORE_TO_BEAT_STATIC_GAMES).toContain("s0-game-1");
    expect(resolveGameRuntimeEndpointMock).not.toHaveBeenCalled();
  });

  it("uses active-stack resolution for non-archived games", async () => {
    resolveGameRuntimeEndpointMock.mockReturnValue("https://active.example/torii/sql");
    const { resolveScoreToBeatGameEndpoint } = await import("./landing-leaderboard-service");

    expect(resolveScoreToBeatGameEndpoint("blitz-season-42", "mainnet")).toBe("https://active.example/torii/sql");
    expect(resolveGameRuntimeEndpointMock).toHaveBeenCalledWith("blitz-season-42", "sql", {
      chain: "mainnet",
      gameType: "blitz",
    });
  });
});
