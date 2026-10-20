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
    // Each paid game puts this share of its pool in the season's chest reserve; the odds above spend about all of it.
    chestLordsBps: 1000,
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

// Production's test launch: no cosmetics, and every chest pays one entry fee of LORDS while the season's reserve holds
// it, else a sword or shield credit. The reserve takes 90% of each pool, all that is left after Blitz's 10% protocol
// cut, so about nine chests in ten pay LORDS and the season-top prize gets only what the chests leave.
// The ledger still requires five cosmetic rarities and a fallback outcome, so the items stay and LORDS stays below 100%.
export function buildLordsChestPreset() {
  const mystery = buildMysteryChestPreset();
  const odds = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, lords: 9998, sword: 1, shield: 1 };
  return {
    chestLordsBps: 9000,
    bands: mystery.bands.map((band) => ({ metadata: band.metadata, odds, lords_shares: 1 })),
    items: mystery.items,
  };
}

export const chestPresets = { mystery: buildMysteryChestPreset, lords: buildLordsChestPreset };

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
/** The cosmetic items some band can award: only these need collection metadata. */
export function awardableCosmetics(preset) {
  return preset.items.flatMap((items, rarity) =>
    preset.bands.some((band) => band.odds[RARITIES[rarity]] > 0) ? items : [],
  );
}
