import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { activeGameRows } from "@/sync/recs-rows";
import { displayAddress } from "@/ui/utils/utils";
import { getAddressName, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";

type WinnerRow = {
  chests: number;
  player: bigint;
  points: bigint;
  rank: number;
};

const POINTS_PRECISION = 1_000_000n;

const formatPoints = (value: bigint): string => {
  const whole = value / POINTS_PRECISION;
  const remainder = value % POINTS_PRECISION;
  const wholeFormatted = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (remainder === 0n) return wholeFormatted;
  return `${wholeFormatted}.${remainder.toString().padStart(6, "0").replace(/0+$/, "")}`;
};

export const WinnersTable = () => {
  const {
    setup: { components },
  } = useDojo();
  const leaderboardRevision = useWorldSlicesStore((state) => state.leaderboardRevision);

  const rows = useMemo<WinnerRow[]>(() => {
    // The revision is the recompute signal, not an input: ranks and registered points are read from RECS here.
    void leaderboardRevision;
    const pointsByPlayer = new Map<bigint, bigint>(
      activeGameRows(components.PlayerRegisteredPoints).map((row) => [
        row.address as bigint,
        row.registered_points as bigint,
      ]),
    );

    return activeGameRows(components.PlayerRank)
      .flatMap((value) => {
        if (Number(value.rank) <= 0) return [];
        const player = value.player as bigint;
        return [
          {
            player,
            rank: Number(value.rank),
            chests: Number(value.chests),
            points: pointsByPlayer.get(player) ?? 0n,
          },
        ];
      })
      .toSorted((left, right) => left.rank - right.rank || (left.player < right.player ? -1 : 1));
  }, [components, leaderboardRevision]);

  const playerName = (address: bigint): string =>
    getAddressName(ContractAddress(address), components) || displayAddress(toHexString(address));

  if (rows.length === 0) return <div className="text-gray-400 text-sm">No ranked players yet.</div>;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gold/70">
          <tr>
            <th className="py-2 pr-4">Rank</th>
            <th className="py-2 pr-4">Player</th>
            <th className="py-2 pr-4">Points</th>
            <th className="py-2 pr-4">Chests</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.player}-${row.rank}`} className="border-t border-gray-700/40">
              <td className="py-2 pr-4">{row.rank}</td>
              <td className="py-2 pr-4">{playerName(row.player)}</td>
              <td className="py-2 pr-4">{formatPoints(row.points)}</td>
              <td className="py-2 pr-4">{row.chests.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
