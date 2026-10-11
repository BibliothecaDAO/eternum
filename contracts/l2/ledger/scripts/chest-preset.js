// Rehearsal values become immutable admin presets, never contract constants.
export function buildMysteryChestPreset() {
  const weights = [
    [2000, 2000, 2000, 1500, 1000, 1000, 250, 250],
    [2500, 2200, 1800, 1000, 500, 1000, 500, 500],
    [3000, 2000, 1200, 600, 200, 500, 1250, 1250],
    [3000, 1800, 800, 300, 100, 400, 1800, 1800],
    [2500, 1500, 700, 200, 100, 0, 2500, 2500],
  ];
  const shares = [4, 2, 1, 0, 0];
  const tokenOdds = [500, 1000, 1000, 0, 0];
  const names = ["common", "uncommon", "rare", "epic", "legendary", "lords", "sword", "shield"];
  return {
    bands: weights.map((row, band) => {
      const nonToken = row.map((weight, index) => (index === 5 ? 0 : weight));
      const total = nonToken.reduce((sum, weight) => sum + weight, 0);
      const available = 10000 - tokenOdds[band];
      const scaled = nonToken.map((weight) => Math.floor((weight * available) / total));
      const remainder = available - scaled.reduce((sum, weight) => sum + weight, 0);
      const order = nonToken
        .map((weight, index) => ({ index, fraction: (weight * available) % total }))
        .filter(({ index }) => index !== 5)
        .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
      for (let index = 0; index < remainder; index++) scaled[order[index].index]++;
      scaled[5] = tokenOdds[band];
      return {
        metadata: 0x301 + band,
        odds: Object.fromEntries(names.map((name, index) => [name, scaled[index]])),
        lords_shares: shares[band],
      };
    }),
    // One test item per rarity; the production inventory needs its own metadata and rarity assignment.
    items: [[0x1011401], [0x3021101], [0x4030f01], [0x4040d01], [0x207050c01]],
  };
}
