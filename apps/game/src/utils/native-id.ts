import { safeInteger } from "@bibliothecadao/eternum/game-client";

/** The structure an army belongs to, or null for an army with no home (owner 0). */
export const armyHomeStructureId = (army: { readonly owner: bigint }): number | null =>
  army.owner === 0n ? null : safeInteger(army.owner);

/** An id read from a story payload's JSON, exact or loud: a missing or malformed one is a broken story, never NaN. */
export const storyPayloadId = (value: unknown): number => {
  if (typeof value !== "number" && typeof value !== "bigint" && typeof value !== "string")
    throw new Error(`Invalid story id ${String(value)}`);
  return safeInteger(value);
};
