export type FeatureType = "feature" | "improvement" | "balance" | "fix";

export interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
}

export const latestFeatures: LatestFeature[] = [
  {
    date: "2026-01-15",
    title: "Open Loot Chests",
    description:
      "Open loot chests directly from the Cosmetics section. Select from your owned chests, watch the animated opening sequence, and reveal your rewards with a premium card reveal experience.",
    type: "feature",
  },
  {
    date: "2026-01-14",
    title: "Prediction Market: Combined Claims",
    description:
      "When claiming from a resolved prediction market, your position winnings and vault fees are now claimed together in a single transaction. The displayed amount shows the combined total for a smoother experience.",
    type: "improvement",
  },
  {
    date: "2026-01-14",
    title: "Prediction Market: Custom Odds",
    description:
      "Create prediction markets with customizable player weights and odds. Select 1-5 players, adjust individual weights, and see real-time percentage chances. The 'None of the above' option is also customizable. Minimum funding reduced to 100 LORDS.",
    type: "feature",
  },
  {
    date: "2026-01-13",
    title: "Transaction Status Center",
    description:
      "A new transaction center is now available in the bottom-right corner. Track all your pending, confirmed, and failed transactions in real-time with a status beacon indicator. Click on any transaction to view details on Voyager.",
    type: "feature",
  },
  {
    date: "2026-01-13",
    title: "Unit Ownership Indicators",
    description:
      "Colored indicator dots now appear above units to clearly show player ownership. Your units display green dots, allies show blue, enemies have distinct colors, and AI agents show gold/amber dots for instant recognition during gameplay.",
    type: "improvement",
  },
  {
    date: "2026-01-09",
    title: "Troop Balance Update",
    description:
      "Paladin stamina has been increased to 120, and mercenary troop bounds have been adjusted to 800-1600 for improved balance.",
    type: "balance",
  },
];
