// From expeditions.cairo::site_reward and progression.cairo::clear_xp. Run scripts/generate-site-previews.mjs.
export function previewSiteReward(
  category: number,
  initialGuardCount: bigint,
): { resourceType: number; amount: bigint } | null {
  if (category === 7) return { resourceType: 23, amount: initialGuardCount / 2n };
  if (category === 11) return { resourceType: 23, amount: initialGuardCount / 4n };
  if (category === 9) return { resourceType: 38, amount: initialGuardCount * 3n };
  return null;
}

export function previewSiteClearXp(initialGuardCount: bigint): number {
  const xp = integerSqrt((initialGuardCount / 1000000000n) * 25n) / 2n;
  if (xp > 0xffff_ffffn) throw new Error("Site clear XP exceeds u32");
  return Number(xp);
}

/** Cairo's integer square root, without converting a scaled troop count to floating point. */
function integerSqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("Negative site strength");
  let root = value;
  let next = (root + 1n) / 2n;
  while (next < root) {
    root = next;
    next = (root + value / root) / 2n;
  }
  return root;
}
