import { estimateClaimableChests } from "@/services/review/chest-reward-estimate";
import { normalizeNonZeroAddress } from "@/services/review/sql-parse-utils";
import { displayAddress } from "@/ui/utils/utils";
import { belongsToActiveGame, getAddressName, toHexString, configManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { gameEntityKey } from "@/sync/game-scope";

const POINTS_PRECISION = 1_000_000n;

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
  const chestRewardEntities = useEntityQuery([Has(components.GameChestReward)]);
  const seasonPrizeEntities = useEntityQuery([Has(components.SeasonPrize)]);
  const chainConfigEntities = useEntityQuery([Has(components.ChainConfig)]);
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
  const chestReward = chestRewardEntities
    .map((entity) => getComponentValue(components.GameChestReward, entity))
    .find((row) => belongsToActiveGame(row));
  const seasonPrize = seasonPrizeEntities
    .map((entity) => getComponentValue(components.SeasonPrize, entity))
    .find((row) => belongsToActiveGame(row));
  const chainConfig = chainConfigEntities
    .map((entity) => getComponentValue(components.ChainConfig, entity))
    .find(Boolean);
  const allocatedRewardChests = toChestCount(chestReward?.allocated_chests);
  const distributedRewardChests = toChestCount(chestReward?.distributed_chests);
  const lootChestAddress = normalizeNonZeroAddress(chainConfig?.collectibles_lootchest_address);
  const totalRegisteredPoints = toBigIntValue(seasonPrize?.total_registered_points) ?? 0n;

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
