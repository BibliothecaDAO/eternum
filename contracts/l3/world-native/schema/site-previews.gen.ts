// @generated from the site reward and ruin guard formulas in Cairo. Run scripts/generate-site-previews.mjs.
export const RELICS_PER_LAYER = 3;

export function previewRuinGuardBounds(rank: number, depth: number): [number, number] {
  const place = rank - 1 - depth;
  const base = [1000, 1500, 2500][place];
  if (base === undefined || place < 0) throw new Error("Relic outside its layer");
  const strength = base * 2 ** depth;
  const spread = (strength * 10) / 100;
  return [strength - spread, strength + spread];
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
