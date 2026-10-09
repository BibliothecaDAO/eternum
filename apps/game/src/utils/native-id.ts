/**
 * A native id handed to a numeric API: refused above 2^53 - 1, never rounded. The contract caps every allocatable id
 * at that bound, so a refusal is a broken fact, not a big one. Mirrors safeInteger in
 * packages/core/src/utils/safe-integer.ts, which @bibliothecadao/eternum does not export yet; this copy goes when it
 * does.
 */
export function safeInteger(value: number | bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Native integer cannot be represented as a JavaScript number");
  return result;
}

/** The structure an army belongs to, or null for an army with no home (owner 0). */
export const armyHomeStructureId = (army: { readonly owner: bigint }): number | null =>
  army.owner === 0n ? null : safeInteger(army.owner);
