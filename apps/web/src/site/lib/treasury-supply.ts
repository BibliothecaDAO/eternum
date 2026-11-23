import { LORDS_TOTAL_SUPPLY } from "@/site/lib/constants";

/** What the economics section shows of the supply: the treasury's share and the rest, or the estimate while there is no complete treasury. */
export function treasurySupply(treasury: { LORDS: { amount: number } } | undefined) {
  const lords = treasury?.LORDS.amount ?? 0;
  if (lords <= 0) return { treasury: "~40%", circulating: "~60%", treasurySub: "Estimated" };
  const treasuryPercentage = ((lords / LORDS_TOTAL_SUPPLY) * 100).toFixed(1);
  return {
    treasury: `${treasuryPercentage}%`,
    circulating: `${(100 - parseFloat(treasuryPercentage)).toFixed(1)}%`,
    treasurySub: "Onchain",
  };
}
