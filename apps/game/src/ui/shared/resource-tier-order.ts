import { isRelic, type ResourcesIds } from "@bibliothecadao/types";

/** Tiers a holding finds or is paid (Lords, Essence), never makes: their rings join a card late, so they go last. */
const FOUND_TIERS = new Set(["lords", "essence"]);

/**
 * The classic HUD's resource order: the game's own tiers (economic, transport, food, then T1, T2, T3), the military
 * tier after them, and found resources last, so a ring that appears mid-game (a first Essence) joins at the end
 * instead of moving every ring after it. Relics are left out; they have their own row.
 */
export const resourcesInTierOrder = (tiers: Record<string, readonly ResourcesIds[]>): ResourcesIds[] => {
  const made: ResourcesIds[] = [];
  const military: ResourcesIds[] = [];
  const found: ResourcesIds[] = [];
  for (const [tier, ids] of Object.entries(tiers)) {
    if (tier === "military") military.push(...ids);
    else if (FOUND_TIERS.has(tier)) found.push(...ids);
    else made.push(...ids);
  }
  return [...made, ...military, ...found].filter((id) => !isRelic(id));
};
