type MMRTier = {
  name: string;
  minMMR: number;
  maxMMR: number;
  color: string;
};

export const MMR_TOKEN_DECIMALS = 10n ** 18n;

const MMR_TIERS: MMRTier[] = [
  { name: "Elite", minMMR: 2850, maxMMR: Infinity, color: "text-relic2" },
  { name: "Master", minMMR: 2400, maxMMR: 2850, color: "text-light-red" },
  { name: "Diamond", minMMR: 1950, maxMMR: 2400, color: "text-blueish" },
  { name: "Platinum", minMMR: 1500, maxMMR: 1950, color: "text-brilliance" },
  { name: "Gold", minMMR: 1050, maxMMR: 1500, color: "text-gold" },
  { name: "Silver", minMMR: 600, maxMMR: 1050, color: "text-light-pink" },
  { name: "Bronze", minMMR: 150, maxMMR: 600, color: "text-orange" },
  { name: "Iron", minMMR: 0, maxMMR: 150, color: "text-gray-gold" },
];

const toMmrInteger = (mmrRaw: bigint): number => Number(mmrRaw / MMR_TOKEN_DECIMALS);

export const getMMRTier = (mmr: number): MMRTier => {
  for (const tier of MMR_TIERS) {
    if (mmr >= tier.minMMR) {
      return tier;
    }
  }

  return MMR_TIERS[MMR_TIERS.length - 1];
};

export const getMMRTierFromRaw = (mmrRaw: bigint): MMRTier => getMMRTier(toMmrInteger(mmrRaw));
