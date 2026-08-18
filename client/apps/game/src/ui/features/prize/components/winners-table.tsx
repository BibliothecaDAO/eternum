import { getActiveWorld } from "@/runtime/world";
import { estimateClaimableChests } from "@/services/review/chest-reward-estimate";
import { normalizeNonZeroAddress } from "@/services/review/sql-parse-utils";
import { displayAddress } from "@/ui/utils/utils";
import { buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
import { belongsToActiveGame, getAddressName, toHexString, configManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../../../env";
import { appchainModel, gameEntityKey } from "@/dojo/game-scope";

const POINTS_PRECISION = 1_000_000n;

// The shared s2 worlds host many games behind one torii: per-game rows lead
// with `game_id`, so scope every read to the ACTIVE game explicitly (the
// winners table only renders in-game, where the active game is the reviewed
// one). ChainConfig is a chain singleton and carries no game id.
const activeGameFilter = (gameId: number) => (gameId > 0 ? `game_id = ${gameId}` : "1=1");

const buildGameChestRewardQuery = (gameId: number) => `
  SELECT
    allocated_chests,
    distributed_chests
  FROM "${appchainModel("GameChestReward")}"
  WHERE ${activeGameFilter(gameId)}
  LIMIT 1;
`;
const buildSeasonPrizeQuery = (gameId: number) => `
  SELECT
    total_registered_points
  FROM "${appchainModel("SeasonPrize")}"
  WHERE ${activeGameFilter(gameId)}
  LIMIT 1;
`;
// s2: the loot chest collection moved to the chain-global ChainConfig singleton.
const REWARD_CHEST_CONFIG_QUERY = `
  SELECT
    collectibles_lootchest_address AS loot_chest_address
  FROM "${appchainModel("ChainConfig")}"
  LIMIT 1;
`;

type GameChestRewardRow = {
  allocated_chests?: unknown;
  distributed_chests?: unknown;
};
type SeasonPrizeRow = {
  total_registered_points?: unknown;
};
type RewardChestConfigRow = {
  loot_chest_address?: unknown;
};
type ChestRewardSnapshot = {
  gameId: number;
  lootChestAddress: string | null;
  allocatedRewardChests: number;
  distributedRewardChests: number;
  totalRegisteredPoints: bigint;
};

let cachedChestRewardSnapshot: ChestRewardSnapshot | null = null;

const toBigIntValue = (value: unknown): bigint | undefined => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const toChestCount = (value: unknown): number => {
  const count = toBigIntValue(value);
  if (count == null || count <= 0n) return 0;

  const asNumber = Number(count);
  return Number.isFinite(asNumber) ? Math.trunc(asNumber) : 0;
};

type Row = {
  player: bigint;
  rank: number;
  paid: boolean;
  prizeShare?: bigint;
  points?: bigint;
  earnedChests?: bigint;
};

export const WinnersTable = ({ trialId }: { trialId?: bigint }) => {
  const {
    // account: { account },
    setup: { components },
  } = useDojo();

  // Get the finalized trial
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const final = useMemo(
    () =>
      finalEntities
        .map((entity) => getComponentValue(components.PlayersRankFinal, entity))
        .find((row) => belongsToActiveGame(row)),
    [finalEntities, components.PlayersRankFinal],
  );
  const finalTrialId = final?.trial_id as bigint | undefined;

  // All player ranks, filtered to the final trial id
  const playerRankEntities = useEntityQuery([Has(components.PlayerRank)]);

  // Registered points per player
  const playerRegisteredPointsEntities = useEntityQuery([Has(components.PlayerRegisteredPoints)]);
  const playerPointsByPlayer = useMemo(() => {
    const points = new Map<bigint, bigint>();
    playerRegisteredPointsEntities.forEach((eid) => {
      const value = getComponentValue(components.PlayerRegisteredPoints, eid);
      if (!value || !belongsToActiveGame(value)) return;
      points.set(value.address as unknown as bigint, value.registered_points as bigint);
    });
    return points;
  }, [playerRegisteredPointsEntities, components.PlayerRegisteredPoints]);

  const activeGameId = configManager.getActiveGameId();
  const [chestRewardSnapshot, setChestRewardSnapshot] = useState<ChestRewardSnapshot | null>(() =>
    cachedChestRewardSnapshot?.gameId === activeGameId ? cachedChestRewardSnapshot : null,
  );
  const allocatedRewardChests = chestRewardSnapshot?.allocatedRewardChests ?? 0;
  const distributedRewardChests = chestRewardSnapshot?.distributedRewardChests ?? 0;
  const lootChestAddress = chestRewardSnapshot?.lootChestAddress ?? null;
  const totalRegisteredPoints = chestRewardSnapshot?.totalRegisteredPoints ?? 0n;

  useEffect(() => {
    let cancelled = false;

    const loadAllocatedRewardChests = async () => {
      try {
        const activeWorld = getActiveWorld();
        const toriiBaseUrl = activeWorld?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII;
        const sqlBaseUrl = toriiBaseUrl.endsWith("/sql") ? toriiBaseUrl : `${toriiBaseUrl}/sql`;

        const [chestRows, seasonRows, configRows] = await Promise.all([
          fetchWithErrorHandling<GameChestRewardRow>(
            buildApiUrl(sqlBaseUrl, buildGameChestRewardQuery(activeGameId)),
            "Failed to fetch game chest reward state",
          ),
          fetchWithErrorHandling<SeasonPrizeRow>(
            buildApiUrl(sqlBaseUrl, buildSeasonPrizeQuery(activeGameId)),
            "Failed to fetch season prize state",
          ),
          fetchWithErrorHandling<RewardChestConfigRow>(
            buildApiUrl(sqlBaseUrl, REWARD_CHEST_CONFIG_QUERY),
            "Failed to fetch reward chest config",
          ),
        ]);

        if (cancelled) return;

        const nextAllocatedRewardChests = toChestCount(chestRows[0]?.allocated_chests);
        const nextDistributedRewardChests = toChestCount(chestRows[0]?.distributed_chests);
        const nextTotalRegisteredPoints = toBigIntValue(seasonRows[0]?.total_registered_points) ?? 0n;
        const nextLootChestAddress = normalizeNonZeroAddress(configRows[0]?.loot_chest_address);

        const nextSnapshot: ChestRewardSnapshot = {
          gameId: activeGameId,
          lootChestAddress: nextLootChestAddress,
          allocatedRewardChests: nextAllocatedRewardChests,
          distributedRewardChests: nextDistributedRewardChests,
          totalRegisteredPoints: nextTotalRegisteredPoints,
        };
        cachedChestRewardSnapshot = nextSnapshot;
        setChestRewardSnapshot(nextSnapshot);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load game chest reward allocation", error);
        }
      }
    };

    void loadAllocatedRewardChests();

    return () => {
      cancelled = true;
    };
  }, [activeGameId]);

  // Fetch ERC20 decimals for the blitz fee token, fallback to raw units
  const decimals = 18;
  const formatTokenAmount = (amount?: bigint) => {
    if (typeof amount !== "bigint") return "-";
    if (decimals == null) return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const d = Math.max(0, decimals);
    if (d === 0) return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (d <= 2) {
      const scaled = amount * 10n ** BigInt(2 - d);
      const whole = scaled / 100n;
      const fractional = (scaled % 100n).toString().padStart(2, "0");
      const wholeFmt = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return fractional === "00" ? wholeFmt : `${wholeFmt}.${fractional}`;
    }

    const divisor = 10n ** BigInt(d - 2);
    const roundedToTwoDecimals = (amount + divisor / 2n) / divisor;
    const whole = roundedToTwoDecimals / 100n;
    const fractional = (roundedToTwoDecimals % 100n).toString().padStart(2, "0");
    const wholeFmt = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fractional === "00" ? wholeFmt : `${wholeFmt}.${fractional}`;
  };
  const pointsPrecision = 1_000_000n;
  const formatPoints = (value?: bigint) => {
    if (typeof value !== "bigint") return "-";
    const whole = value / pointsPrecision;
    const remainder = value % pointsPrecision;
    const wholeFmt = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (remainder === 0n) return wholeFmt;
    const frac = remainder.toString().padStart(6, "0").replace(/0+$/, "");
    return `${wholeFmt}.${frac}`;
  };
  const formatInteger = (value?: bigint) => {
    if (typeof value !== "bigint") return "-";
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const rows = useMemo(() => {
    const useTrialId = typeof trialId === "bigint" ? trialId : finalTrialId;
    if (!useTrialId) return [] as Row[];
    const list: Row[] = playerRankEntities
      .map((eid) => getComponentValue(components.PlayerRank, eid))
      .filter(
        (r) =>
          r &&
          belongsToActiveGame(r) &&
          ((r as { trial_id?: bigint }).trial_id === undefined || (r as { trial_id?: bigint }).trial_id === useTrialId),
      )
      .map((r) => {
        const player = r!.player as unknown as bigint;
        const points = playerPointsByPlayer.get(player);
        const safePoints = typeof points === "bigint" ? points : 0n;
        const chestEstimate = estimateClaimableChests({
          lootChestAddress,
          allocatedChests: allocatedRewardChests,
          distributedChests: distributedRewardChests,
          playerRegisteredPoints: safePoints,
          totalRegisteredPoints,
        });

        return {
          player,
          rank: Number(r!.rank),
          paid: Boolean(r!.paid),
          points,
          earnedChests: BigInt(chestEstimate.count),
        };
      });

    // Attach prize per rank. s2 keys RankPrize by (game_id, rank) — the trial
    // id only keys legacy (s1) worlds.
    const withPrize = list.map((r) => {
      const prizeId =
        configManager.getActiveGameId() > 0
          ? gameEntityKey([BigInt(r.rank)])
          : getEntityIdFromKeys([useTrialId as unknown as bigint, BigInt(r.rank)]);
      const prize = getComponentValue(components.RankPrize, prizeId as never);
      let share: bigint | undefined = undefined;
      if (prize && prize.total_players_same_rank_count > 0) {
        try {
          const total: bigint = prize.total_prize_amount as bigint;
          share = total / BigInt(prize.total_players_same_rank_count);
        } catch {
          share = undefined;
        }
      }
      return { ...r, prizeShare: share };
    });

    // Sort by rank ascending
    return withPrize.toSorted((a, b) => a.rank - b.rank);
  }, [
    playerRankEntities,
    components.PlayerRank,
    components.RankPrize,
    finalTrialId,
    trialId,
    playerPointsByPlayer,
    allocatedRewardChests,
    distributedRewardChests,
    lootChestAddress,
    totalRegisteredPoints,
  ]);

  // Helper to get player display name
  const getPlayerDisplayName = (playerAddress: bigint): string => {
    const name = getAddressName(ContractAddress(playerAddress), components);
    return name || displayAddress(toHexString(playerAddress));
  };

  const displayTrialId = typeof trialId === "bigint" ? trialId : finalTrialId;
  if (!displayTrialId) return <div className="text-gray-400 text-sm">No rankings for this trial yet.</div>;
  if (rows.length === 0) return <div className="text-gray-400 text-sm">No ranked players yet.</div>;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gold/70">
          <tr>
            <th className="py-2 pr-4">Rank</th>
            <th className="py-2 pr-4">Player</th>
            <th className="py-2 pr-4">Points</th>
            <th className="py-2 pr-4">Chests Earned</th>
            <th className="py-2 pr-4">Prize Share</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${String(displayTrialId)}-${r.player}-${r.rank}`} className="border-t border-gray-700/40">
              <td className="py-2 pr-4">{r.rank}</td>
              <td className="py-2 pr-4">{getPlayerDisplayName(r.player)}</td>
              <td className="py-2 pr-4">{formatPoints(r.points)}</td>
              <td className="py-2 pr-4">{formatInteger(r.earnedChests)}</td>
              <td className="py-2 pr-4">
                {typeof r.prizeShare === "bigint" ? (
                  <span className="inline-flex items-center gap-1">
                    <img src="/tokens/lords.png" alt="LORDS" className="h-4 w-4 rounded-full object-contain" />
                    <span>{formatTokenAmount(r.prizeShare)}</span>
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="py-2 pr-4">{r.paid ? "Claimed" : "Unclaimed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
