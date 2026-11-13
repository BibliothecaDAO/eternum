// From the site reward, clear XP and rift guard formulas in Cairo. Run scripts/generate-site-previews.mjs.
export function previewRiftGuardBound(camp: number, step: number): number {
  return Math.floor((camp * 115 + step * 50) / (step * 100)) * step;
}

export function previewSiteReward(
  category: number,
  beastKind: string,
  initialGuardCount: bigint,
  depth: number,
): { resourceType: number; amount: bigint } | null {
  if (category === 11) {
    if (beastKind === "Cyclops") return { resourceType: 35, amount: initialGuardCount * 4n };
    if (beastKind === "Wraith") return null;
    throw new Error("Beast site has no kind");
  }
  if (category === 7) return { resourceType: 23, amount: depthReward(initialGuardCount / 2n, depth) };
  if (category === 9) return { resourceType: 38, amount: depthReward(initialGuardCount * 3n, depth) };
  return null;
}

export function previewSiteClearXp(initialGuardCount: bigint, depth: number, beastKind: string): number {
  const xp =
    depthReward(integerSqrt((initialGuardCount / 1000000000n) * 25n) / 2n, depth) * (beastKind === "Wraith" ? 3n : 1n);
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
