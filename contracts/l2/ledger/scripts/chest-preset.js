// Rehearsal values become immutable admin presets, never contract constants.
export function buildMysteryChestPreset(lordsUnit = 10n ** 18n) {
  const weights = [
    [2000, 2000, 2000, 1500, 1000, 1000, 250, 250],
    [2500, 2200, 1800, 1000, 500, 1000, 500, 500],
    [3000, 2000, 1200, 600, 200, 500, 1250, 1250],
    [3000, 1800, 800, 300, 100, 400, 1800, 1800],
    [2500, 1500, 700, 200, 100, 0, 2500, 2500],
  ];
  const amounts = [700n, 200n, 100n, 50n, 20n];
  const names = ["common", "uncommon", "rare", "epic", "legendary", "lords", "sword", "shield"];
  return {
    bands: weights.map((row, band) => {
      const amount = amounts[band] * lordsUnit;
      return {
        metadata: 0x301 + band,
        odds: Object.fromEntries(names.map((name, index) => [name, row[index]])),
        lords_amount: { low: (amount % 2n ** 128n).toString(), high: (amount / 2n ** 128n).toString() },
      };
    }),
    // One test item per rarity; the production inventory needs its own metadata and rarity assignment.
    items: [[0x1011401], [0x3021101], [0x4030f01], [0x4040d01], [0x207050c01]],
  };
}
