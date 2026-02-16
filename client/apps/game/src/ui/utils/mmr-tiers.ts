export type MMRTier = {
  name: string;
  minMMR: number;
  maxMMR: number;
  color: string;
};

export const MMR_TIERS: MMRTier[] = [
  { name: "Elite", minMMR: 2850, maxMMR: Infinity, color: "text-purple-400" },
  { name: "Master", minMMR: 2400, maxMMR: 2850, color: "text-red-400" },
  { name: "Diamond", minMMR: 1950, maxMMR: 2400, color: "text-cyan-400" },
  { name: "Platinum", minMMR: 1500, maxMMR: 1950, color: "text-emerald-400" },
  { name: "Gold", minMMR: 1050, maxMMR: 1500, color: "text-yellow-400" },
  { name: "Silver", minMMR: 600, maxMMR: 1050, color: "text-gray-300" },
  { name: "Bronze", minMMR: 150, maxMMR: 600, color: "text-orange-400" },
  { name: "Iron", minMMR: 0, maxMMR: 150, color: "text-stone-500" },
];

export const getMMRTier = (mmr: number): MMRTier => {
  for (const tier of MMR_TIERS) {
    if (mmr >= tier.minMMR) {
      return tier;
    }
  }

  return MMR_TIERS[MMR_TIERS.length - 1];
};
