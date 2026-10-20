import { getConfigFromNetwork, type GameType } from "@config";
import { DOCS_CHAIN } from "../../env";

/**
 * A mode's balance as the game reads it, from its generated config document. Every caller names its mode: a page is
 * Blitz's or Eternum's, and a shared component takes its page's mode, so a Blitz page never reads Eternum's numbers.
 * A missing mode fails the build at prerender instead of falling back to one.
 */
export const ETERNUM_CONFIG = (gameType: GameType) => {
  if (!gameType) throw new Error("ETERNUM_CONFIG needs the page's game mode");
  return strict(getConfigFromNetwork(DOCS_CHAIN, gameType), gameType);
};

/**
 * The config as a page reads it: a key the mode's config does not hold fails the build at prerender, naming its path,
 * instead of reaching the page as undefined and then as NaN or a silent 0.
 */
const PROBES = new Set(["toJSON", "then", "$$typeof"]);

const strict = (value: unknown, path: string): any => {
  if (value === null || typeof value !== "object") return value;
  return new Proxy(value as object, {
    get(target, key, receiver) {
      if (typeof key === "symbol") return Reflect.get(target, key, receiver);
      if (key in target) return strict(Reflect.get(target, key, receiver), `${path}.${key}`);
      // Protocol probes (JSON, promises, React elements) ask for keys a config never holds.
      if (PROBES.has(key)) return undefined;
      throw new Error(`The ${path.split(".")[0]} config has no ${path}.${key}`);
    },
  });
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

/** The largest u64: a capacity the game sets to it has no limit. */
const U64_MAX = "18446744073709551615";

/**
 * A structure's storage as a page states it: "Unbounded" where the mode sets no limit, else its kilograms. A zero is
 * not a capacity a page can state, so it fails the build.
 */
export const storageOf = (gameType: GameType, capacity: number) => {
  const grams = ETERNUM_CONFIG(gameType).carryCapacityGram[capacity];
  if (String(grams) === U64_MAX) return "Unbounded";
  if (Number(grams) <= 0) throw new Error(`The ${gameType} config sets storage ${capacity} to ${grams}`);
  return `${(Number(grams) / 1000).toLocaleString("en-US")} kg`;
};

/** A duration in seconds as words: whole hours, else whole minutes. */
export const durationOf = (seconds: number) => {
  if (!(seconds > 0)) throw new Error(`A duration of ${seconds} seconds is not one a page can state`);
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
  return `${Math.round(seconds / 60)} minute${seconds === 60 ? "" : "s"}`;
};

/** The resource id of T1 Knights; each realm's reserve is the same count of whichever type it is dealt. */
const KNIGHT_T1 = 26;

/** A Blitz realm's starting forces as the pages state them: its garrison and its reserve. */
export const startingForcesOf = (gameType: GameType) => {
  const config = ETERNUM_CONFIG(gameType);
  const reserve = config.startingResources.find((stack: { resource: number }) => stack.resource === KNIGHT_T1);
  if (!reserve) throw new Error(`The ${gameType} config starts no realm with troops in reserve`);
  return {
    garrison: Number(config.troop.limit.startingGuard).toLocaleString("en-US"),
    reserve: Number(reserve.amount).toLocaleString("en-US"),
  };
};
