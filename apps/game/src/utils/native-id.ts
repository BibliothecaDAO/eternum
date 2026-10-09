import { safeInteger } from "@bibliothecadao/eternum/game-client";

/** The structure an army belongs to, or null for an army with no home (owner 0). */
export const armyHomeStructureId = (army: { readonly owner: bigint }): number | null =>
  army.owner === 0n ? null : safeInteger(army.owner);
