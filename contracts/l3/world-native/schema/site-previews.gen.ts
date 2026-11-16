// From the site reward and rift guard formulas in Cairo. Run scripts/generate-site-previews.mjs.
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
  band: boolean,
): { resourceType: number; amount: bigint } | null {
  if (band) return null;
  if (category === 7) return { resourceType: 23, amount: depthReward(initialGuardCount / 2n, depth) };
  if (category === 11) return { resourceType: 35, amount: depthReward(initialGuardCount * 4n, depth) };
  if (category === 9) return { resourceType: 38, amount: depthReward(initialGuardCount * 3n, depth) };
  return null;
}

function depthReward(amount: bigint, depth: number): bigint {
  return (amount * (2n + BigInt(depth))) / 2n;
}
