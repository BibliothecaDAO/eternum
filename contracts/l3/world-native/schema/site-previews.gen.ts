// From expeditions.cairo::site_reward and progression.cairo::clear_xp. Run scripts/generate-site-previews.mjs.
export function previewSiteReward(
  category: number,
  initialGuardCount: bigint,
  depth: number,
): { resourceType: number; amount: bigint } | null {
  if (category === 7) return { resourceType: 23, amount: depthReward(initialGuardCount / 2n, depth) };
  if (category === 11) return { resourceType: 23, amount: depthReward(initialGuardCount / 4n, depth) };
  if (category === 9) return { resourceType: 38, amount: depthReward(initialGuardCount * 3n, depth) };
  return null;
}

export function previewSiteClearXp(initialGuardCount: bigint, depth: number): number {
  const xp = depthReward(integerSqrt((initialGuardCount / 1000000000n) * 25n) / 2n, depth);
  if (xp > 0xffff_ffffn) throw new Error("Site clear XP exceeds u32");
  return Number(xp);
}

function depthReward(amount: bigint, depth: number): bigint {
  return (amount * (2n + BigInt(depth))) / 2n;
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
