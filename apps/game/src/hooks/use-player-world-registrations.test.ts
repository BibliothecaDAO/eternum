// @vitest-environment node
import type { WorldSummary } from "@bibliothecadao/types";
import type { WorldDeployment } from "@/runtime/world/world-directory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({
  useQueries: vi.fn(),
}));

const directoryMocks = vi.hoisted(() => ({
  getWorldById: vi.fn(),
  getDefaultWorld: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("@/runtime/world/world-directory", () => directoryMocks);

import {
  fetchPlayerRegistration,
  getWorldSummaryKey,
  usePlayerWorldRegistrations,
} from "./use-player-world-registrations";

const mockFetch = vi.fn<typeof globalThis.fetch>();

const deployment = {
  id: "blitz",
  chain: "madara",
  heraldBaseUrl: "https://herald.example",
} as WorldDeployment;

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

const makeSummary = (overrides: Partial<WorldSummary>): WorldSummary => ({
  name: "alpha",
  chain: "appchain",
  worldId: "blitz",
  gameId: 7,
  alive: true,
  lastCheckedAt: 0,
  mode: "blitz",
  startSettlingAt: null,
  startMainAt: null,
  endAt: null,
  devModeOn: null,
  mmrEnabled: null,
  singleRealmMode: null,
  twoPlayerMode: null,
  seasonPassAddress: null,
  villagePassAddress: null,
  worldAddress: null,
  prizeDistributionAddress: null,
  entryTokenAddress: null,
  feeTokenAddress: null,
  feeAmount: null,
  registrationCount: null,
  registrationCountMax: null,
  registrationStartAt: null,
  registrationEndAt: null,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
  winnerJackpotAmount: null,
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  reactQueryMocks.useQueries.mockReset();
  directoryMocks.getWorldById.mockReset();
  directoryMocks.getDefaultWorld.mockReset();
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("fetchPlayerRegistration", () => {
  it("returns true when a settlement row exists for the game", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(settlementSnapshot(["0x123"])), { status: 200 }));

    const result = await fetchPlayerRegistration(deployment, "0x123", 7);
    expect(result).toBe(true);
    const [url] = mockFetch.mock.calls[0]! as [string];
    expect(url).toBe("https://herald.example/madara/games/7/snapshot?models=BlitzSettlement");
  });

  it("returns false when the snapshot has no player settlement", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(settlementSnapshot([])), { status: 200 }));

    const result = await fetchPlayerRegistration(deployment, "0x123", 7);
    expect(result).toBe(false);
  });

  it("surfaces a failed Herald response", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(fetchPlayerRegistration(deployment, "0x123", 7)).rejects.toThrow("Herald snapshot");
  });

  it("surfaces a transport error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));

    await expect(fetchPlayerRegistration(deployment, "0x123", 7)).rejects.toThrow("boom");
  });
});

describe("usePlayerWorldRegistrations", () => {
  it("disables all queries when no playerAddress is supplied", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", mode: "blitz" })],
      playerAddress: null,
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    const [queryOpts] = call[0].queries;
    expect(queryOpts.enabled).toBe(false);
  });

  it("enables blitz games and eternum seasons with a game id; unknown modes stay off", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [
        makeSummary({ name: "blitz-game", mode: "blitz", gameId: 7 }),
        makeSummary({ name: "eternum-season", mode: "eternum", gameId: 1 }),
        makeSummary({ name: "unknown-game", mode: null }),
        makeSummary({ name: "registry-only", mode: "blitz", gameId: null }),
      ],
      playerAddress: "0xplayer",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    const [blitz, eternum, unknown, registryOnly] = call[0].queries;

    expect(blitz.enabled).toBe(true);
    expect(eternum.enabled).toBe(true);
    expect(unknown.enabled).toBe(false);
    expect(registryOnly.enabled).toBe(false);
  });

  it("disables offline (dead) games even when the player is connected", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "dead-game", mode: "blitz", alive: false })],
      playerAddress: "0xplayer",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    const [opts] = call[0].queries;
    expect(opts.enabled).toBe(false);
  });

  it("keys each query on world + player so results cache separately", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", chain: "appchain", mode: "blitz" })],
      playerAddress: "0xplayer",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ queryKey: unknown[] }> }]];
    const [opts] = call[0].queries;
    expect(opts.queryKey).toEqual([
      "playerWorldRegistration",
      getWorldSummaryKey({ name: "alpha", chain: "appchain", worldId: "blitz", gameId: 7 }),
      "0xplayer",
    ]);
  });

  it("uses 'anonymous' in the key when playerAddress is null", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", chain: "appchain", mode: "blitz" })],
      playerAddress: null,
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ queryKey: unknown[] }> }]];
    const [opts] = call[0].queries;
    expect(opts.queryKey[2]).toBe("anonymous");
  });

  it("returns a map keyed by (worldId, gameId) from queries", () => {
    reactQueryMocks.useQueries.mockReturnValue([
      { data: { isPlayerRegistered: true, hasPlayerSettledRealm: null }, isLoading: false },
      { data: { isPlayerRegistered: null, hasPlayerSettledRealm: null }, isLoading: false },
    ]);

    const result = usePlayerWorldRegistrations({
      worlds: [
        makeSummary({ name: "alpha", chain: "appchain", mode: "blitz", worldId: "blitz", gameId: 7 }),
        makeSummary({ name: "beta", chain: "appchain", mode: "eternum", worldId: "eternum", gameId: 7 }),
      ],
      playerAddress: "0xplayer",
    });

    expect(result.registrationsByWorldKey.get("blitz:7")).toEqual({
      isPlayerRegistered: true,
      hasPlayerSettledRealm: null,
    });
    expect(result.registrationsByWorldKey.get("eternum:7")).toEqual({
      isPlayerRegistered: null,
      hasPlayerSettledRealm: null,
    });
  });

  it("surfaces loading state from child queries", () => {
    reactQueryMocks.useQueries.mockReturnValue([{ data: undefined, isLoading: true, isFetching: true, error: null }]);

    const result = usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", mode: "blitz" })],
      playerAddress: "0xplayer",
    });

    expect(result.isAnyLoading).toBe(true);
  });

  it("returns null-fields when a query has no data yet", () => {
    reactQueryMocks.useQueries.mockReturnValue([{ data: undefined, isLoading: false }]);

    const result = usePlayerWorldRegistrations({
      worlds: [makeSummary({ name: "alpha", chain: "appchain", mode: "blitz" })],
      playerAddress: "0xplayer",
    });

    expect(result.registrationsByWorldKey.get("blitz:7")).toEqual({
      isPlayerRegistered: null,
      hasPlayerSettledRealm: null,
    });
  });
});
