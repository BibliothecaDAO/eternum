import { getActiveWorld } from "@/runtime/world";
import { displayAddress } from "@/ui/utils/utils";
import { buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
import { getAddressName, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../../../env";

const POINTS_PRECISION = 1_000_000n;
const GAME_REWARD_CHEST_POINTS_THRESHOLD = 500n * POINTS_PRECISION;
const GAME_CHEST_REWARD_QUERY = `
  SELECT
    allocated_chests
  FROM "s1_eternum-GameChestReward"
  LIMIT 1;
`;
const SEASON_PRIZE_QUERY = `
  SELECT
    total_registered_points
  FROM "s1_eternum-SeasonPrize"
  LIMIT 1;
`;

type GameChestRewardRow = {
  allocated_chests?: unknown;
};
type SeasonPrizeRow = {
  total_registered_points?: unknown;
};
type ChestRewardSnapshot = {
  allocatedRewardChests: bigint;
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
    () => (finalEntities[0] ? getComponentValue(components.PlayersRankFinal, finalEntities[0]) : undefined),
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
      if (!value) return;
      points.set(value.address as unknown as bigint, value.registered_points as bigint);
    });
    return points;
  }, [playerRegisteredPointsEntities, components.PlayerRegisteredPoints]);

  const [chestRewardSnapshot, setChestRewardSnapshot] = useState<ChestRewardSnapshot | null>(
    () => cachedChestRewardSnapshot,
  );
  const allocatedRewardChests = chestRewardSnapshot?.allocatedRewardChests ?? 0n;
  const totalRegisteredPoints = chestRewardSnapshot?.totalRegisteredPoints ?? 0n;

  useEffect(() => {
    let cancelled = false;

    const loadAllocatedRewardChests = async () => {
      try {
        const activeWorld = getActiveWorld();
        const toriiBaseUrl = activeWorld?.toriiBaseUrl ?? env.VITE_PUBLIC_TORII;
        const sqlBaseUrl = toriiBaseUrl.endsWith("/sql") ? toriiBaseUrl : `${toriiBaseUrl}/sql`;

        const [chestRows, seasonRows] = await Promise.all([
          fetchWithErrorHandling<GameChestRewardRow>(
            buildApiUrl(sqlBaseUrl, GAME_CHEST_REWARD_QUERY),
            "Failed to fetch game chest reward state",
          ),
          fetchWithErrorHandling<SeasonPrizeRow>(
            buildApiUrl(sqlBaseUrl, SEASON_PRIZE_QUERY),
            "Failed to fetch season prize state",
          ),
        ]);

        if (cancelled) return;

        const nextAllocatedRewardChests = toBigIntValue(chestRows[0]?.allocated_chests);
        const nextTotalRegisteredPoints = toBigIntValue(seasonRows[0]?.total_registered_points);
        if (nextAllocatedRewardChests == null || nextTotalRegisteredPoints == null) {
          return;
        }

        const nextSnapshot: ChestRewardSnapshot = {
          allocatedRewardChests: nextAllocatedRewardChests,
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
  }, []);

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
      .filter((r) => r && (r.trial_id as bigint) === useTrialId)
      .map((r) => {
        const player = r!.player as unknown as bigint;
        const points = playerPointsByPlayer.get(player);
        const safePoints = typeof points === "bigint" ? points : 0n;
        const guaranteedChestCount = safePoints >= GAME_REWARD_CHEST_POINTS_THRESHOLD ? 1n : 0n;
        const proportionalChestCount =
          allocatedRewardChests > 0n && totalRegisteredPoints > 0n
            ? (allocatedRewardChests * safePoints) / totalRegisteredPoints
            : 0n;

        return {
          player,
          rank: Number(r!.rank),
          paid: Boolean(r!.paid),
          points,
          earnedChests: guaranteedChestCount + proportionalChestCount,
        };
      });

    // Attach prize per rank
    const withPrize = list.map((r) => {
      const prizeId = getEntityIdFromKeys([useTrialId as unknown as bigint, BigInt(r.rank)]);
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
