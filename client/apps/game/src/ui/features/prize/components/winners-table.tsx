import { displayAddress } from "@/ui/utils/utils";
import { toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";


type Row = {
  player: bigint;
  rank: number;
  paid: boolean;
  prizeShare?: bigint;
  points?: bigint;
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
    [finalEntities],
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

  // Fetch ERC20 decimals for the blitz fee token, fallback to raw units
  const decimals = 18;
  const formatTokenAmount = (amount?: bigint) => {
    if (typeof amount !== "bigint") return "-";
    if (decimals == null) return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const d = decimals;
    const s = amount.toString();
    const pad = d - s.length;
    const whole = pad >= 0 ? "0" : s.slice(0, s.length - d);
    const fracRaw = pad >= 0 ? "0".repeat(pad) + s : s.slice(s.length - d);
    const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const frac = fracRaw.replace(/0+$/, "");
    return frac.length > 0 ? `${wholeFmt}.${frac}` : wholeFmt;
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
  const rows = useMemo(() => {
    const useTrialId = typeof trialId === "bigint" ? trialId : finalTrialId;
    if (!useTrialId) return [] as Row[];
    const list: Row[] = playerRankEntities
      .map((eid) => getComponentValue(components.PlayerRank, eid))
      .filter((r) => r && (r.trial_id as bigint) === useTrialId)
      .map((r) => {
        const player = r!.player as unknown as bigint;
        return {
          player,
          rank: Number(r!.rank),
          paid: Boolean(r!.paid),
          points: playerPointsByPlayer.get(player),
        };
      });

    // Attach prize per rank
    const withPrize = list.map((r) => {
      const prizeId = getEntityIdFromKeys([useTrialId as unknown as bigint, BigInt(r.rank)]);
      const prize = getComponentValue(components.RankPrize, prizeId as any);
      let share: bigint | undefined = undefined;
      if (prize && prize.total_players_same_rank_count > 0) {
        try {
          const total: bigint = prize.total_prize_amount as bigint;
          share = total / BigInt(prize.total_players_same_rank_count);
        } catch {}
      }
      return { ...r, prizeShare: share };
    });

    // Sort by rank ascending
    return withPrize.sort((a, b) => a.rank - b.rank);
  }, [
    playerRankEntities,
    components.PlayerRank,
    components.RankPrize,
    finalTrialId,
    trialId,
    decimals,
    playerPointsByPlayer,
  ]);

  const displayTrialId = typeof trialId === "bigint" ? trialId : finalTrialId;
  if (!displayTrialId) return <div className="text-gray-400 text-sm">No rankings for this trial yet.</div>;
  if (rows.length === 0) return <div className="text-gray-400 text-sm">No ranked players yet.</div>;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-400">
          <tr>
            <th className="py-2 pr-4">Rank</th>
            <th className="py-2 pr-4">Player</th>
            <th className="py-2 pr-4">Points</th>
            <th className="py-2 pr-4">Prize Share</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${String(displayTrialId)}-${r.player}-${r.rank}`} className="border-t border-gray-700/40">
              <td className="py-2 pr-4">{r.rank}</td>
              <td className="py-2 pr-4 font-mono">{displayAddress(toHexString(r.player))}</td>
              <td className="py-2 pr-4">{formatPoints(r.points)}</td>
              <td className="py-2 pr-4">{formatTokenAmount(r.prizeShare)}</td>
              <td className="py-2 pr-4">{r.paid ? "Claimed" : "Unclaimed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
