// From the site reward, clear XP and rift guard formulas in Cairo. Run scripts/generate-site-previews.mjs.
export function previewRuinGuardBounds(rank: number): [number, number] {
  const strength = [1000, 2500, 5000, 10000, 25000][rank - 1];
  if (strength === undefined) throw new Error("Invalid relic rank");
  const spread = (strength * 10) / 100;
  return [strength - spread, strength + spread];
}

export function previewRiftGuardBound(camp: number, step: number): number {
  return Math.floor((camp * 115 + step * 50) / (step * 100)) * step;
}

export function previewSiteReward(
  category: number,
  initialGuardCount: bigint,
  depth: number,
  wraith: boolean,
): { resourceType: number; amount: bigint } | null {
  if (wraith) return null;
  if (category === 7) return { resourceType: 23, amount: depthReward(initialGuardCount / 2n, depth) };
  if (category === 11) return { resourceType: 35, amount: depthReward(initialGuardCount * 4n, depth) };
  if (category === 9) return { resourceType: 38, amount: depthReward(initialGuardCount * 3n, depth) };
  return null;
}

export function previewSiteClearXp(initialGuardCount: bigint, depth: number, wraith: boolean): number {
  const xp = depthReward(integerSqrt((initialGuardCount / 1000000000n) * 25n) / 2n, depth);
  if (xp > 0xffff_ffffn) throw new Error("Site clear XP exceeds u32");
  return Number(xp) * (wraith ? 3 : 1);
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
