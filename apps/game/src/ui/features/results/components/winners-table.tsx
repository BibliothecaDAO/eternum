import { configManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { getPlayerDisplayName, usePlayerNamesRevision } from "@/hooks/use-player-profile";
import {
  readFinalBlitzResult,
  REGISTERED_POINTS_PRECISION,
} from "@/ui/features/social/player/finalized-blitz-leaderboard";

const RESULT_FACTS = ["BlitzResult", "BlitzRoster", "PlayerPoints"] as const;

const formatPoints = (value: bigint): string => {
  const whole = value / REGISTERED_POINTS_PRECISION;
  const remainder = value % REGISTERED_POINTS_PRECISION;
  const wholeFormatted = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (remainder === 0n) return wholeFormatted;
  return `${wholeFormatted}.${remainder.toString().padStart(6, "0").replace(/0+$/, "")}`;
};

export const WinnersTable = () => {
  const {
    setup: { store },
  } = useGame();
  const leaderboardRevision = useNativeRevision(RESULT_FACTS);
  usePlayerNamesRevision();

  const result = useMemo(() => {
    void leaderboardRevision;
    return readFinalBlitzResult(store, configManager.getActiveGameId());
  }, [store, leaderboardRevision]);

  const playerName = (address: bigint): string => getPlayerDisplayName(address);

  if (result.status === "waiting") return <div className="text-gray-400 text-sm">Waiting for the final result…</div>;
  if (result.status === "unavailable") return <div className="text-gray-400 text-sm">Result unavailable.</div>;
  const rows = result.standings;
  if (rows.length === 0) return <div className="text-gray-400 text-sm">No ranked players.</div>;

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
            <tr key={`${row.account}-${row.rank}`} className="border-t border-gray-700/40">
              <td className="py-2 pr-4">{row.rank}</td>
              <td className="py-2 pr-4">{playerName(row.account)}</td>
              <td className="py-2 pr-4">{formatPoints(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
