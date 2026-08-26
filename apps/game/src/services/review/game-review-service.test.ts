// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LandingLeaderboardEntry } from "@/services/leaderboard/landing-leaderboard-service";

const TEST_PLAYER_ADDRESS = "0x062ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33";
const TEST_TRIAL_ID_HEX = "0x00000000000000000000000000001c6b";
const TEST_LORDS_SHARE_HEX = "0x1bc16d674ec80000"; // 2 LORDS with 18 decimals
const TEST_LOOT_CHEST_ADDRESS = "0x123";
const TEST_PLAYER_REGISTERED_POINTS_HEX = "0x77359400"; // 2,000 VP with 1e6 precision
const TEST_TOTAL_REGISTERED_POINTS_HEX = "0xEE6B2800"; // 4,000 VP with 1e6 precision

// The reviewed game's identity on the shared s2 world: the game lives in the
// "blitz" directory world behind that world's torii, as GameRegistry game 5.
const TEST_WORLD_TORII_BASE_URL = "https://torii.blitz.test/torii";
const TEST_GAME_ID = 5;

const fetchLandingLeaderboardMock = vi.fn<(...args: unknown[]) => Promise<LandingLeaderboardEntry[]>>();
const fetchLandingLeaderboardEntryByAddressMock =
  vi.fn<(...args: unknown[]) => Promise<LandingLeaderboardEntry | null>>();
const fetchWithErrorHandlingMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

let lootChestAddress = TEST_LOOT_CHEST_ADDRESS;
let allocatedChests = 2;
let distributedChests = 0;

vi.mock("@/services/leaderboard/landing-leaderboard-service", () => ({
  fetchLandingLeaderboard: (...args: unknown[]) => fetchLandingLeaderboardMock(...args),
  fetchLandingLeaderboardEntryByAddress: (...args: unknown[]) => fetchLandingLeaderboardEntryByAddressMock(...args),
}));

vi.mock("./game-review-stats-utils", () => ({
  fetchFirstBloodMetric: vi.fn(async () => null),
  fetchGameReviewCompetitiveMetrics: vi.fn(async () => ({
    mostTroopsKilled: null,
    biggestStructuresOwned: null,
  })),
  fetchGameReviewMilestoneTimings: vi.fn(async () => ({
    timeToFirstT3Seconds: null,
    timeToFirstHyperstructureSeconds: null,
  })),
}));

vi.mock("@/runtime/world", () => ({
  buildWorldProfile: vi.fn(),
  patchManifestWithFactory: vi.fn((manifest: unknown) => manifest),
}));

vi.mock("@/runtime/world/world-directory", () => ({
  getWorldById: vi.fn((worldId: string | null | undefined) =>
    worldId === "blitz"
      ? {
          id: "blitz",
          chain: "appchain",
          rpcUrl: "http://localhost:5050",
          toriiBaseUrl: TEST_WORLD_TORII_BASE_URL,
          namespace: "s2",
          worldAddress: "0xworld",
          contractsBySelector: {},
        }
      : null,
  ),
}));

vi.mock("@/runtime/world/game-registry", () => ({
  resolveWorldIdForGame: vi.fn(async () => "blitz"),
  resolveGameId: vi.fn(async () => TEST_GAME_ID),
  fetchS2GameRow: vi.fn(async () => ({ gameId: TEST_GAME_ID, presetId: 2 })),
}));

vi.mock("@/ui/features/prize/utils/mmr-utils", () => ({
  commitAndClaimMMR: vi.fn(),
}));

vi.mock("@bibliothecadao/torii", () => ({
  buildApiUrl: (baseUrl: string, query: string) => `${baseUrl}?query=${encodeURIComponent(query)}`,
  fetchWithErrorHandling: (...args: unknown[]) => fetchWithErrorHandlingMock(...args),
}));

vi.mock("@bibliothecadao/types", () => ({
  RESOURCE_PRECISION: 1_000_000,
  WORLD_CONFIG_ID: 999999999n,
  tileDataToTile: vi.fn(() => ({
    alt: false,
    col: 0,
    row: 0,
    biome: 0,
    occupier_id: 0,
    occupier_type: 0,
    occupier_is_structure: false,
    reward_extracted: false,
  })),
}));

vi.mock("@contracts", () => ({
  getGameManifest: vi.fn(),
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_NODE_URL: "http://localhost:5050",
    VITE_PUBLIC_CHAIN: "appchain",
  },
}));

vi.mock("starknet", () => ({
  hash: {
    getSelectorFromName: vi.fn(() => "0xselector"),
  },
}));

const decodeQueryFromUrl = (url: string): string => {
  const queryIndex = url.indexOf("?query=");
  if (queryIndex < 0) return "";
  return decodeURIComponent(url.slice(queryIndex + "?query=".length));
};

describe("game-review-service reward query formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lootChestAddress = TEST_LOOT_CHEST_ADDRESS;
    allocatedChests = 2;
    distributedChests = 0;

    fetchLandingLeaderboardMock.mockResolvedValue([
      {
        rank: 1,
        address: TEST_PLAYER_ADDRESS,
        displayName: "Tester",
        points: 1234,
        registeredPoints: 1234,
        unregisteredPoints: 0,
        prizeClaimed: false,
      },
    ] as LandingLeaderboardEntry[]);
    fetchLandingLeaderboardEntryByAddressMock.mockResolvedValue(null);

    fetchWithErrorHandlingMock.mockImplementation(async (urlArg: unknown) => {
      const url = String(urlArg);

      // Every review query must target the directory world's torii — never a
      // legacy per-game Cartridge host.
      if (!url.startsWith(`${TEST_WORLD_TORII_BASE_URL}/sql?query=`)) {
        throw new Error(`Review SQL sent to an unexpected torii: ${url}`);
      }

      const query = decodeQueryFromUrl(url);
      const normalizedQuery = query.toLowerCase();
      const gameScoped = normalizedQuery.includes(`game_id = ${TEST_GAME_ID}`);

      if (normalizedQuery.includes('from "s2-blitzsettlement"')) {
        if (!gameScoped) throw new Error(`Unscoped BlitzSettlement query in test: ${query}`);
        return [{ player: TEST_PLAYER_ADDRESS }];
      }

      if (normalizedQuery.includes('from "s2-playersrankfinal"')) {
        if (!gameScoped) throw new Error(`Unscoped PlayersRankFinal query in test: ${query}`);
        return [{ trial_id: TEST_TRIAL_ID_HEX }];
      }

      if (normalizedQuery.includes('from "s2-mmrgamemeta"')) {
        if (!gameScoped) throw new Error(`Unscoped MMRGameMeta query in test: ${query}`);
        return [{ game_median: 0 }];
      }

      // Chain singleton: MMR config lives on ChainConfig with no game filter.
      if (normalizedQuery.includes('from "s2-chainconfig"') && normalizedQuery.includes("mmr_enabled")) {
        return [{ mmr_enabled: 0, mmr_min_players: 6, mmr_token_address: "0x0" }];
      }

      if (normalizedQuery.includes('from "s2-gameregistry"') && normalizedQuery.includes("season_end_at")) {
        if (!gameScoped) throw new Error(`Unscoped season timing query in test: ${query}`);
        return [
          {
            dev_mode_on: 0,
            season_end_at: 100,
            registration_grace_seconds: 0,
            registration_count: 4,
            loot_chest_address: lootChestAddress,
          },
        ];
      }

      if (normalizedQuery.includes('from "s2-storyevent"') && normalizedQuery.includes("explorercreatestory")) {
        if (!gameScoped) throw new Error(`Unscoped StoryEvent query in test: ${query}`);
        return [];
      }

      if (normalizedQuery.includes('from "s2-tileopt"')) {
        if (!gameScoped) throw new Error(`Unscoped TileOpt query in test: ${query}`);
        return [];
      }

      if (normalizedQuery.includes("from transactions")) {
        return [{ transaction_count: 42 }];
      }

      if (normalizedQuery.includes('from "s2-playerregisteredpoints"') && normalizedQuery.includes("prize_claimed")) {
        if (!gameScoped) throw new Error(`Unscoped PlayerRegisteredPoints query in test: ${query}`);
        return [{ registered_points: TEST_PLAYER_REGISTERED_POINTS_HEX, prize_claimed: 0 }];
      }

      if (normalizedQuery.includes('from "s2-gamechestreward"')) {
        if (!gameScoped) throw new Error(`Unscoped GameChestReward query in test: ${query}`);
        return [{ allocated_chests: allocatedChests, distributed_chests: distributedChests }];
      }

      if (normalizedQuery.includes('from "s2-seasonprize"')) {
        if (!gameScoped) throw new Error(`Unscoped SeasonPrize query in test: ${query}`);
        return [{ total_registered_points: TEST_TOTAL_REGISTERED_POINTS_HEX }];
      }

      if (normalizedQuery.includes('from "s2-playerrank"')) {
        // s2 keys PlayerRank by (game_id, player) — no trial_id column.
        if (!gameScoped) throw new Error(`Unscoped PlayerRank query in test: ${query}`);
        return [{ rank: 1, paid: 0 }];
      }

      if (normalizedQuery.includes('from "s2-rankprize"')) {
        // s2 keys RankPrize by (game_id, rank) — the trial id only keyed legacy worlds.
        if (gameScoped && normalizedQuery.includes("rank = '1'")) {
          return [{ total_players_same_rank_count: 1, total_prize_amount: TEST_LORDS_SHARE_HEX, grant_elite_nft: 0 }];
        }
        return [];
      }

      if (normalizedQuery.includes('from "s2-playersranktrial"')) {
        // The finalized trial id keys the trial row's `nonce`; torii stores it
        // as padded hex, so the query must match the hex form too.
        if (gameScoped && normalizedQuery.includes("nonce") && normalizedQuery.includes("1c6b")) {
          return [{ total_player_count_committed: 4 }];
        }
        return [];
      }

      throw new Error(`Unhandled SQL query in test: ${query}`);
    });
  });

  it("computes non-zero lords reward when finalized trial id is hex-formatted", async () => {
    const { fetchGameReviewData } = await import("./game-review-service");

    const data = await fetchGameReviewData({
      worldName: "adam-14",
      chain: "appchain",
      playerAddress: TEST_PLAYER_ADDRESS,
    });

    expect(data.rewards).not.toBeNull();
    expect(data.rewards?.isRanked).toBe(true);
    expect(data.rewards?.lordsWonRaw).toBe(2_000_000_000_000_000_000n);
    expect(data.rewards?.lordsWonFormatted).toBe("2");
  });

  it("resolves the owning world's torii and scopes queries to the game id", async () => {
    const { fetchGameReviewData } = await import("./game-review-service");

    await fetchGameReviewData({
      worldName: "adam-14",
      chain: "appchain",
      playerAddress: TEST_PLAYER_ADDRESS,
    });

    const requestedUrls = fetchWithErrorHandlingMock.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url.startsWith(`${TEST_WORLD_TORII_BASE_URL}/sql?query=`)).toBe(true);
    }

    const settlementQuery = requestedUrls
      .map((url) => decodeQueryFromUrl(url).toLowerCase())
      .find((query) => query.includes('from "s2-blitzsettlement"'));
    expect(settlementQuery).toBeDefined();
    expect(settlementQuery).toContain(`game_id = ${TEST_GAME_ID}`);
  });

  it("does not estimate loot chests when the game has no loot chest collectible configured", async () => {
    lootChestAddress = "0x0";
    const { fetchGameReviewClaimSummary } = await import("./game-review-service");

    const summary = await fetchGameReviewClaimSummary({
      worldName: "adam-14",
      chain: "appchain",
      playerAddress: TEST_PLAYER_ADDRESS,
    });

    expect(summary.canClaimNow).toBe(true);
    expect(summary.chestsClaimedEstimate).toBe(0);
  });

  it("caps proportional loot chests by the remaining allocated chest pool", async () => {
    distributedChests = allocatedChests;
    const { fetchGameReviewClaimSummary } = await import("./game-review-service");

    const summary = await fetchGameReviewClaimSummary({
      worldName: "adam-14",
      chain: "appchain",
      playerAddress: TEST_PLAYER_ADDRESS,
    });

    expect(summary.chestsClaimedEstimate).toBe(1);
  });
});
