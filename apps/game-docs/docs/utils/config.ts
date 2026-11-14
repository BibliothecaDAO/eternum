import type { Config } from "@bibliothecadao/types";
import { getConfigFromNetwork, type GameType } from "@config";
import { DOCS_CHAIN } from "../../env";

/**
 * A mode's balance as the game reads it, from its generated config document. Every caller names its mode: a page is
 * Blitz's or Frontier's, and a shared component takes its page's mode, so a Blitz page never reads Frontier's numbers.
 * A missing mode fails the build at prerender instead of falling back to one.
 */
export const ETERNUM_CONFIG = (gameType: GameType): Config => {
  if (!gameType) throw new Error("ETERNUM_CONFIG needs the page's game mode");
  return strict(getConfigFromNetwork(DOCS_CHAIN, gameType), gameType);
};

/**
 * The config as a page reads it: a key the mode's config does not hold fails the build at prerender, naming its path,
 * instead of reaching the page as undefined and then as NaN or a silent 0.
 */
const PROBES = new Set(["toJSON", "then", "$$typeof"]);

const strict = <T>(value: T, path: string): T => {
  if (value === null || typeof value !== "object") return value;
  return new Proxy(value, {
    get(target, key, receiver) {
      if (typeof key === "symbol") return Reflect.get(target, key, receiver);
      if (key in target) return strict(Reflect.get(target, key, receiver), `${path}.${key}`);
      // Protocol probes (JSON, promises, React elements) ask for keys a config never holds.
      if (PROBES.has(key)) return undefined;
      throw new Error(`The ${path.split(".")[0]} config has no ${path}.${key}`);
    },
  });
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
