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

const registryMocks = vi.hoisted(() => ({
  resolveWorldIdForGame: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("@/runtime/world/world-directory", () => directoryMocks);
vi.mock("@/runtime/world/game-registry", () => registryMocks);

import type { WorldDeployment } from "@/runtime/world/world-directory";
import { useWorldsAvailability } from "./use-world-availability";

const mockFetch = vi.fn<typeof globalThis.fetch>();

const blitzWorld = {
  id: "blitz",
  chain: "madara",
  heraldBaseUrl: "https://herald.example",
} as WorldDeployment;

const gameDirectory = (games: Array<Record<string, unknown>>) => ({
  chain: "madara",
  chain_config: {
    entry_token_address: "0xe",
    fee_token_address: "0xf",
    mmr_enabled: false,
  },
  confirmed_block: 12,
  games,
});

const quickBlitz = {
  game_id: 7,
  name: "quickblitz",
  preset_id: 1,
  status: "Live",
  dev_mode_on: true,
  mode: "blitz",
  clock: {
    start_settling_at: 100,
    start_main_at: 200,
    end_at: 3800,
    end_grace_seconds: 60,
    registration_grace_seconds: 120,
  },
  registration: { count: 3, max: 60, start_at: 50, fee_amount: "0x0" },
  settlement: {
    base_distance: 8,
    layer_max: 6,
    layers_skipped: 2,
    map_center_offset: 10,
    single_realm_mode: false,
    spires_layer_distance: 0,
    spires_max_count: 0,
    spires_settled_count: 0,
    two_player_mode: true,
  },
  player_count: 3,
  settled_realms_count: 9,
  settled_villages_count: 0,
};

const quickEternum = {
  ...quickBlitz,
  mode: "eternum",
  name: "quicketernum",
};

const settlementSnapshot = (players: string[]) => ({
  confirmed_block: 12,
  game_id: "7",
  models: [
    {
      model: "BlitzSettlement",
      rows: players.map((player, index) => ({ key: `0x${index + 1}`, value: { game_id: "0x7", player } })),
    },
  ],
});

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
  directoryMocks.getWorldById.mockReturnValue(blitzWorld);
  directoryMocks.getDefaultWorld.mockReset();
  directoryMocks.getDefaultWorld.mockReturnValue(blitzWorld);
  registryMocks.resolveWorldIdForGame.mockReset();
  registryMocks.resolveWorldIdForGame.mockResolvedValue("blitz");
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("useWorldsAvailability (appchain game meta)", () => {
  it("resolves the chosen game's metadata from the Herald directory", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(gameDirectory([quickBlitz])), { status: 200 }));

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
    expect(url).toBe("https://herald.example/madara/games");
  });

  it("adds a game-scoped settlement snapshot when a player is connected", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(gameDirectory([quickBlitz])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(settlementSnapshot(["0x123"])), { status: 200 }));

    const result = await runAvailabilityQuery("quickblitz", "0x123");

    expect(result.meta).toMatchObject({ gameId: 7, isPlayerRegistered: true });
    const [snapshotUrl] = mockFetch.mock.calls[1]! as [string];
    expect(snapshotUrl).toBe("https://herald.example/madara/games/7/snapshot?models=BlitzSettlement");
  });

  it("reads an Eternum player's nested Structure category from Herald", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(gameDirectory([quickEternum])), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            confirmed_block: 12,
            game_id: "7",
            models: [
              {
                model: "Structure",
                rows: [
                  {
                    key: "0x1",
                    value: {
                      base: { category: "0x1", coord_x: "0x2", coord_y: "0x3", level: "0x1" },
                      entity_id: "0x4",
                      metadata: { has_wonder: false, realm_id: "0x5" },
                      owner: "0x123",
                      resources_packed: "0x0",
                    },
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await runAvailabilityQuery("quicketernum", "0x123");

    expect(result.meta).toMatchObject({ gameId: 7, hasPlayerSettledRealm: true });
  });

  it("surfaces a Herald directory failure", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(runAvailabilityQuery("quickblitz")).rejects.toThrow("Herald directory");
  });

  it("reports unavailable when the directory has no matching game", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(gameDirectory([])), { status: 200 }));

    const result = await runAvailabilityQuery("ghost-game");

    expect(result.isAvailable).toBe(false);
    expect(result.meta).toMatchObject({ gameId: null, mode: "unknown" });
  });
});
