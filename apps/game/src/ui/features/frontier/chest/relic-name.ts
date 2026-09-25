import { LOOT_ITEMS, LOOT_NAME_PREFIXES, LOOT_NAME_SUFFIXES, LOOT_ORDER_SUFFIXES } from "./loot-words";

/**
 * A relic's Loot name, such as "Grim Shout Katana of Power": prefix, name suffix, item and Order, in Loot's grammar.
 * It is flavour, not a fact, so it comes from the chest story's stable identity (game, order, index): the same story
 * always gives the same name, on every device and after every reload.
 */
export const relicName = (story: readonly [gameId: string, order: string, index: string]): string => {
  const pick = (words: readonly string[], part: number) => words[fnv1a(`${story.join(":")}:${part}`) % words.length];
  return `${pick(LOOT_NAME_PREFIXES, 0)} ${pick(LOOT_NAME_SUFFIXES, 1)} ${pick(LOOT_ITEMS, 2)} ${pick(LOOT_ORDER_SUFFIXES, 3)}`;
};

/** 32-bit FNV-1a: small, stable and well spread for short keys. */
const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};
