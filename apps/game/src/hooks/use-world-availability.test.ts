// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQueries: vi.fn(),
}));

const directoryMocks = vi.hoisted(() => ({
  getWorldById: vi.fn(),
  getDefaultWorld: vi.fn(),
  getWorldDirectory: vi.fn(() => []),
}));

const resolverMocks = vi.hoisted(() => ({
  isToriiAvailable: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("@/runtime/world/world-directory", () => directoryMocks);
vi.mock("@/runtime/world/torii-health", () => resolverMocks);

import { nameToPaddedFelt } from "@/runtime/world/normalize";
import { useWorldsAvailability } from "./use-world-availability";

const mockFetch = vi.fn<typeof globalThis.fetch>();

const blitzWorld = { id: "blitz", toriiBaseUrl: "https://torii.example" };

/** Run the hook with a real queryFn passthrough so fetch behavior is exercised. */
const runAvailabilityQuery = async (worldName: string, playerAddress?: string | null) => {
  let capturedQueryFn: (() => Promise<unknown>) | null = null;
  reactQueryMocks.useQueries.mockImplementation(
    ({ queries }: { queries: Array<{ queryFn: () => Promise<unknown> }> }) => {
      capturedQueryFn = queries[0]?.queryFn ?? null;
      return [{ data: undefined, isLoading: true, error: null }];
    },
  );

  useWorldsAvailability([{ name: worldName, chain: "appchain" }], true, playerAddress);
  if (!capturedQueryFn) throw new Error("queryFn not captured");
  return (capturedQueryFn as () => Promise<{ isAvailable: boolean; meta: Record<string, unknown> | null }>)();
};

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  reactQueryMocks.useQueries.mockReset();
  directoryMocks.getWorldById.mockReset();
  directoryMocks.getWorldById.mockReturnValue(null);
  directoryMocks.getDefaultWorld.mockReset();
  directoryMocks.getDefaultWorld.mockReturnValue(blitzWorld);
  resolverMocks.isToriiAvailable.mockReset();
  resolverMocks.isToriiAvailable.mockResolvedValue(true);
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("useWorldsAvailability (appchain game meta)", () => {
  it("resolves the chosen game's meta with one joined padded-name query", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            game_id: 7,
            dev_mode_on: 1,
            start_settling_at: 100,
            start_main_at: 200,
            end_at: 3800,
            blitz_mode_on: 1,
            registration_count: 3,
            registration_count_max: 60,
            registration_start_at: 50,
            fee_amount: "0x0",
            single_realm_mode: 0,
            two_player_mode: 1,
            entry_token_address: "0xe",
            fee_token: "0xf",
          },
        ]),
        { status: 200 },
      ),
    );

    const result = await runAvailabilityQuery("quickblitz");

    expect(result.isAvailable).toBe(true);
    expect(result.meta).toMatchObject({
      gameId: 7,
      mode: "blitz",
      startMainAt: 200,
      endAt: 3800,
      seasonDurationSeconds: 3600,
      devModeOn: true,
      registrationCount: 3,
      registrationCountMax: 60,
      // Registration closes when the main phase opens.
      registrationEndAt: 200,
      twoPlayerMode: true,
      entryTokenAddress: "0xe",
      feeTokenAddress: "0xf",
    });

    const [url] = mockFetch.mock.calls[0]! as [string];
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain(`g.name = "${nameToPaddedFelt("quickblitz")}"`);
    expect(decoded).toContain("GameRegistry");
    expect(decoded).toContain("ChainConfig");
  });

  it("adds a game-scoped registration check when a player is connected", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ game_id: 7, blitz_mode_on: 1, dev_mode_on: 0, fee_amount: "0x0" }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ player: "0xplayer" }]), { status: 200 }));

    const result = await runAvailabilityQuery("quickblitz", "0xplayer");

    expect(result.meta).toMatchObject({ gameId: 7, isPlayerRegistered: true });
    const [registrationUrl] = mockFetch.mock.calls[1]! as [string];
    expect(decodeURIComponent(registrationUrl)).toContain("game_id = 7");
  });

  it("reports unavailable without meta when the world's torii is down", async () => {
    resolverMocks.isToriiAvailable.mockResolvedValueOnce(false);

    const result = await runAvailabilityQuery("quickblitz");

    expect(result).toEqual({ isAvailable: false, meta: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty meta (no game id) when the name has no registry row", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const result = await runAvailabilityQuery("ghost-game");

    expect(result.isAvailable).toBe(true);
    expect(result.meta).toMatchObject({ gameId: null, mode: "unknown" });
  });
});
