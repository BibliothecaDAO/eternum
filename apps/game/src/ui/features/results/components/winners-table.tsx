import { configManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { getPlayerDisplayName, usePlayerNamesRevision } from "@/hooks/use-player-profile";

type WinnerRow = {
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
    setup: { store },
  } = useGame();
  const leaderboardRevision = useNativeRevision(["BlitzResult"]);
  usePlayerNamesRevision();

  const rows = useMemo<WinnerRow[]>(() => {
    void leaderboardRevision;
    const result = store.get("BlitzResult", { game_id: configManager.getActiveGameId() });
    if (!result?.complete) return [];
    return result.players.toSorted((left, right) => left.rank - right.rank || (left.player < right.player ? -1 : 1));
  }, [store, leaderboardRevision]);

  const playerName = (address: bigint): string => getPlayerDisplayName(address);

  if (rows.length === 0) return <div className="text-gray-400 text-sm">No ranked players yet.</div>;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gold/70">
          <tr>
            <th className="py-2 pr-4">Rank</th>
            <th className="py-2 pr-4">Player</th>
            <th className="py-2 pr-4">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.player}-${row.rank}`} className="border-t border-gray-700/40">
              <td className="py-2 pr-4">{row.rank}</td>
              <td className="py-2 pr-4">{playerName(row.player)}</td>
              <td className="py-2 pr-4">{formatPoints(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
