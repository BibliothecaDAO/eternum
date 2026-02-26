// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LandingLeaderboardEntry } from "@/services/leaderboard/landing-leaderboard-service";

const TEST_PLAYER_ADDRESS = "0x062ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33";
const TEST_TRIAL_ID_HEX = "0x00000000000000000000000000001c6b";
const TEST_LORDS_SHARE_HEX = "0x1bc16d674ec80000"; // 2 LORDS with 18 decimals

const fetchLandingLeaderboardMock = vi.fn<(...args: unknown[]) => Promise<LandingLeaderboardEntry[]>>();
const fetchLandingLeaderboardEntryByAddressMock = vi.fn<
  (...args: unknown[]) => Promise<LandingLeaderboardEntry | null>
>();
const fetchWithErrorHandlingMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();

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

vi.mock("@/ui/features/prize/utils/mmr-utils", () => ({
  commitAndClaimMMR: vi.fn(),
}));

vi.mock("@bibliothecadao/torii", () => ({
  buildApiUrl: (baseUrl: string, query: string) => `${baseUrl}?query=${encodeURIComponent(query)}`,
  fetchWithErrorHandling: (...args: unknown[]) => fetchWithErrorHandlingMock(...args),
  SqlApi: class MockSqlApi {
    async fetchAllTiles() {
      return [];
    }
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  RESOURCE_PRECISION: 1_000_000,
}));

vi.mock("@contracts", () => ({
  getGameManifest: vi.fn(),
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_NODE_URL: "http://localhost:5050",
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
      const query = decodeQueryFromUrl(url);
      const normalizedQuery = query.toLowerCase();

      if (normalizedQuery.includes('from "s1_eternum-blitzrealmplayerregister"')) {
        return [{ player: TEST_PLAYER_ADDRESS }];
      }

      if (
        normalizedQuery.includes('from "s1_eternum-playersrankfinal"') &&
        normalizedQuery.includes("order by trial_id desc")
      ) {
        return [{ trial_id: TEST_TRIAL_ID_HEX }];
      }

      if (normalizedQuery.includes('from "s1_eternum-mmrgamemeta"')) {
        return [{ game_median: 0 }];
      }

      if (normalizedQuery.includes('from "s1_eternum-worldconfig"') && normalizedQuery.includes("mmr_enabled")) {
        return [{ mmr_enabled: 0, mmr_min_players: 6, mmr_token_address: "0x0" }];
      }

      if (normalizedQuery.includes('from "s1_eternum-worldconfig"') && normalizedQuery.includes("season_end_at")) {
        return [{ season_end_at: 100, registration_grace_seconds: 0, registration_count: 4 }];
      }

      if (normalizedQuery.includes('from "s1_eternum-storyevent"') && normalizedQuery.includes("explorercreatestory")) {
        return [];
      }

      if (normalizedQuery.includes("from transactions")) {
        return [{ transaction_count: 42 }];
      }

      if (
        normalizedQuery.includes('from "s1_eternum-playerregisteredpoints"') &&
        normalizedQuery.includes("prize_claimed")
      ) {
        return [{ registered_points: "0x77359400", prize_claimed: 0 }];
      }

      if (normalizedQuery.includes('from "s1_eternum-gamechestreward"')) {
        return [{ allocated_chests: 2, distributed_chests: 0 }];
      }

      if (normalizedQuery.includes('from "s1_eternum-seasonprize"')) {
        return [{ total_registered_points: "0xEE6B2800" }];
      }

      if (normalizedQuery.includes('from "s1_eternum-playerrank" pr')) {
        return [{ trial_id: TEST_TRIAL_ID_HEX, rank: 1, paid: 0 }];
      }

      if (normalizedQuery.includes('from "s1_eternum-rankprize"')) {
        // Simulate adam-14 behavior: trial_id is stored/read as hex.
        // Query must reference hex-normalized trial id, not only decimal bigint string.
        if (normalizedQuery.includes("1c6b")) {
          return [{ total_players_same_rank_count: 1, total_prize_amount: TEST_LORDS_SHARE_HEX, grant_elite_nft: 0 }];
        }
        return [];
      }

      if (normalizedQuery.includes('from "s1_eternum-playersranktrial"')) {
        if (normalizedQuery.includes("1c6b")) {
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
      chain: "sepolia",
      playerAddress: TEST_PLAYER_ADDRESS,
    });

    expect(data.rewards).not.toBeNull();
    expect(data.rewards?.isRanked).toBe(true);
    expect(data.rewards?.lordsWonRaw).toBe(2_000_000_000_000_000_000n);
    expect(data.rewards?.lordsWonFormatted).toBe("2");
  });
});
