import { seasonClockView } from "@/sync/fact-views";
import { useFactView } from "@/hooks/use-fact-view";
import { configManager } from "@bibliothecadao/eternum";
import { useMemo } from "react";

/** What scores, as the game's rules grant it: whole points per action. */
export interface PointsGrants {
  exploreTile: number;
  claimCampFromBandits: number;
  claimHyperstructureFromBandits: number;
  openRelicCrate: number;
}

/** A match's length as a player reads it: "1h", "1h 30m", "45m". */
export const matchLength = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
};

/** The game's goal in one line: "Most points in 1h wins", or "Most points wins" for a game with no set end. */
export const goalLine = (lengthSeconds: number | null): string =>
  lengthSeconds !== null && lengthSeconds > 0
    ? `Most points in ${matchLength(lengthSeconds)} wins`
    : "Most points wins";

/** The goal and what scores, in one sentence: the start banner's words. */
export const goalSentence = (lengthSeconds: number | null, grants: PointsGrants): string =>
  `${goalLine(lengthSeconds)}: explore (+${grants.exploreTile.toLocaleString()} a tile), open crates (+${grants.openRelicCrate.toLocaleString()}), ` +
  `take camps and rifts (+${grants.claimCampFromBandits.toLocaleString()}) and Hyperstructures ` +
  `(+${grants.claimHyperstructureFromBandits.toLocaleString()}, then points every second).`;

/** The running game's length in seconds, from its main start to its end; null for a game with no set end. */
const useMatchLengthSeconds = (): number | null => {
  const { gameStartMainAt, gameEndAt } = useFactView(seasonClockView);
  return gameStartMainAt && gameEndAt && Number.isFinite(gameEndAt) ? gameEndAt - gameStartMainAt : null;
};

/** The running game's goal line and its one-sentence goal with the scoring, from its clock and its rules. */
export const usePointsGoal = () => {
  const lengthSeconds = useMatchLengthSeconds();
  return useMemo(
    () => ({
      line: goalLine(lengthSeconds),
      sentence: goalSentence(lengthSeconds, configManager.getVictoryPointGrants()),
    }),
    [lengthSeconds],
  );
};
