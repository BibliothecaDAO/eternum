import { isRelic, type ResourcesIds } from "@bibliothecadao/types";

/**
 * The classic HUD's resource order: the game's own tiers (economic, transport, food, then T1, T2, T3), with the
 * military tier apart and relics left out, since they have their own row.
 */
export const resourcesInTierOrder = (
  tiers: Record<string, readonly ResourcesIds[]>,
): { resourceIds: ResourcesIds[]; militaryIds: ResourcesIds[] } => {
  const resourceIds: ResourcesIds[] = [];
  let militaryIds: ResourcesIds[] = [];
  for (const [tier, ids] of Object.entries(tiers)) {
    if (tier === "military") militaryIds = [...ids];
    else resourceIds.push(...ids);
  }
  return { resourceIds: resourceIds.filter((id) => !isRelic(id)), militaryIds };
};
