import type { Config } from "@bibliothecadao/types";
import { getConfigFromNetwork, type GameType } from "@config";
import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { mergeConfigPatches } from "../../../../config/source/common/merge-config";
import { DOCS_CHAIN } from "../../env";

/**
 * A mode's active balance: its generated configuration with the current preset's overrides. Every caller names its
 * mode, and a shared component takes its page's mode, so a Blitz page never reads Frontier's numbers.
 * A missing mode fails the build at prerender instead of falling back to one.
 */
export const ETERNUM_CONFIG = (gameType: GameType): Config => {
  if (!gameType) throw new Error("ETERNUM_CONFIG needs the page's game mode");
  const preset = nativePresetForId(nativePresetIdFor(gameType));
  return strict(mergeConfigPatches<Config>(getConfigFromNetwork(DOCS_CHAIN, gameType), preset.balance), gameType);
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
