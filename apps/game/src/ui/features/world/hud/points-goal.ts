import { formatExact, formatDuration } from "@bibliothecadao/types";
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

/** The game's goal in one line: "Most points in 1h wins", or "Most points wins" for a game with no set end. */
export const goalLine = (lengthSeconds: number | null): string =>
  lengthSeconds !== null && lengthSeconds > 0
    ? `Most points in ${formatDuration(lengthSeconds)} wins`
    : "Most points wins";

/**
 * The goal and what scores, in one compact line: the top bar's hover. "Most points in 1h wins ·
 * tile +5 · crate +250 · camp or rift +250 · Hyperstructure +1,000, then per second".
 */
export const goalScoring = (lengthSeconds: number | null, grants: PointsGrants): string =>
  [
    goalLine(lengthSeconds),
    `tile +${formatExact(grants.exploreTile)}`,
    `crate +${formatExact(grants.openRelicCrate)}`,
    `camp or rift +${formatExact(grants.claimCampFromBandits)}`,
    `Hyperstructure +${formatExact(grants.claimHyperstructureFromBandits)}, then per second`,
  ].join(" · ");

/** The running game's length in seconds, from its main start to its end; null for a game with no set end. */
const useMatchLengthSeconds = (): number | null => {
  const { gameStartMainAt, gameEndAt } = useFactView(seasonClockView);
  return gameStartMainAt && gameEndAt && Number.isFinite(gameEndAt) ? gameEndAt - gameStartMainAt : null;
};

/** The running game's goal alone, "Most points in 1h wins": the start banner's line. */
export const useGoalLine = (): string => goalLine(useMatchLengthSeconds());

/** The running game's goal and scoring in one compact line, from its clock and its rules. */
export const usePointsGoal = (): string => {
  const lengthSeconds = useMatchLengthSeconds();
  return useMemo(() => goalScoring(lengthSeconds, configManager.getVictoryPointGrants()), [lengthSeconds]);
};
