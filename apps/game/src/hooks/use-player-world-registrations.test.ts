// @vitest-environment node
import type { WorldSummary } from "@bibliothecadao/types";
import type { WorldDeployment } from "@/runtime/world/world-directory";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reactQueryMocks = vi.hoisted(() => ({ useQueries: vi.fn() }));
const directoryMocks = vi.hoisted(() => ({ getDefaultWorld: vi.fn(), getWorldById: vi.fn() }));

vi.mock("@tanstack/react-query", () => reactQueryMocks);
vi.mock("@/runtime/world/world-directory", () => directoryMocks);

import { getWorldSummaryKey, usePlayerWorldRegistrations } from "./use-player-world-registrations";

const blitzDeployment = {
  id: "blitz",
  chain: "madara",
  heraldBaseUrl: "https://herald.example",
} as WorldDeployment;
const eternumDeployment = {
  id: "eternum",
  chain: "madara",
  heraldBaseUrl: "https://herald.example",
} as WorldDeployment;

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
  reactQueryMocks.useQueries.mockReset();
  directoryMocks.getDefaultWorld.mockReturnValue(blitzDeployment);
  directoryMocks.getWorldById.mockImplementation((worldId: string) =>
    worldId === "eternum" ? eternumDeployment : worldId === "blitz" ? blitzDeployment : undefined,
  );
});

describe("usePlayerWorldRegistrations", () => {
  it("uses one disabled query per deployment when no player is connected", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ gameId: 7 }), makeSummary({ gameId: 8, name: "beta" })],
      playerAddress: null,
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: Array<{ enabled: boolean }> }]];
    expect(call[0].queries).toHaveLength(1);
    expect(call[0].queries[0]?.enabled).toBe(false);
  });

  it("deduplicates every game in one deployment onto one player-scoped directory request", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [makeSummary({ gameId: 7 }), makeSummary({ gameId: 8, name: "beta" })],
      playerAddress: "0x123",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [
      [{ queries: Array<{ enabled: boolean; queryKey: unknown[] }> }],
    ];
    expect(call[0].queries).toHaveLength(1);
    expect(call[0].queries[0]?.enabled).toBe(true);
    expect(call[0].queries[0]?.queryKey).toEqual(["playerWorldRegistration", "blitz", "0x123"]);
  });

  it("keeps separate deployment directories separate", () => {
    reactQueryMocks.useQueries.mockReturnValue([]);

    usePlayerWorldRegistrations({
      worlds: [
        makeSummary({ worldId: "blitz", gameId: 7 }),
        makeSummary({ worldId: "eternum", gameId: 1, mode: "eternum" }),
      ],
      playerAddress: "0x123",
    });

    const [call] = reactQueryMocks.useQueries.mock.calls as [[{ queries: unknown[] }]];
    expect(call[0].queries).toHaveLength(2);
  });

  it("maps annotated directory rows back to the world/game identity", () => {
    reactQueryMocks.useQueries.mockReturnValue([
      {
        data: {
          games: [
            { game_id: 7, player_state: { registered: true, settled: true } },
            { game_id: 8, player_state: { registered: false, settled: false } },
          ],
        },
        isLoading: false,
      },
    ]);

    const worlds = [
      makeSummary({ gameId: 7, mode: "blitz" }),
      makeSummary({ gameId: 8, mode: "eternum", name: "beta" }),
    ];
    const result = usePlayerWorldRegistrations({ worlds, playerAddress: "0x123" });

    expect(result.registrationsByWorldKey.get("blitz:7")).toEqual({
      isPlayerRegistered: true,
      hasPlayerSettledRealm: null,
    });
    expect(result.registrationsByWorldKey.get("blitz:8")).toEqual({
      isPlayerRegistered: null,
      hasPlayerSettledRealm: false,
    });
  });

  it("surfaces one deployment query's loading state", () => {
    reactQueryMocks.useQueries.mockReturnValue([{ data: undefined, isLoading: true, isFetching: true, error: null }]);

    const result = usePlayerWorldRegistrations({ worlds: [makeSummary({})], playerAddress: "0x123" });

    expect(result.isAnyLoading).toBe(true);
  });

  it("keeps the stable world/game key", () => {
    expect(getWorldSummaryKey(makeSummary({ worldId: "blitz", gameId: 7 }))).toBe("blitz:7");
  });
});
