import { getConfigFromNetwork, type GameType } from "@config";
import { DOCS_CHAIN } from "../../env";

/**
 * A mode's balance as the game reads it, from its generated config document. Every caller names its mode: a page is
 * Blitz's or Eternum's, and a shared component takes its page's mode, so a Blitz page never reads Eternum's numbers.
 * A missing mode fails the build at prerender instead of falling back to one.
 */
export const ETERNUM_CONFIG = (gameType: GameType) => {
  if (!gameType) throw new Error("ETERNUM_CONFIG needs the page's game mode");
  return getConfigFromNetwork(DOCS_CHAIN, gameType);
};

/** Points are stored in millionths; a page states whole points. */
const POINTS_PRECISION = 1_000_000;

/**
 * A mode's stamina as its pages state it: a phase is one armies tick, and a day six of them. Pages read these instead
 * of doing arithmetic in MDX, which the formatter escapes.
 */
export const staminaOf = (gameType: GameType) => {
  const config = ETERNUM_CONFIG(gameType);
  const stamina = config.troop.stamina;
  const tickSeconds = config.tick.armiesTickIntervalInSeconds;
  return {
    perPhase: stamina.staminaGainPerTick,
    perDay: stamina.staminaGainPerTick * 6,
    phaseMinutes: tickSeconds / 60,
    dayMinutes: (tickSeconds * 6) / 60,
    attack: stamina.staminaAttackReq,
    defense: stamina.staminaDefenseReq,
    explore: stamina.staminaExploreStaminaCost,
  };
};

/** A victory-point award in whole points, written as pages write numbers. */
export const victoryPointsOf = (gameType: GameType, award: string) =>
  (Number(ETERNUM_CONFIG(gameType).victoryPoints[award]) / POINTS_PRECISION).toLocaleString("en-US");
