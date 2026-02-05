export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
}

export const latestFeatures: LatestFeature[] = [
  {
    date: "2026-02-05",
    title: "Markets Page Redesign",
    description:
      "The markets section now features a split-panel layout with Active Markets and Past Markets side by side on desktop. The new TrendingUp icon makes markets easier to find, and the responsive design adapts to mobile with tab navigation.",
    type: "improvement",
  },
  {
    date: "2026-02-05",
    title: "Inline Game Registration",
    description:
      "Register for games directly from the landing page without navigating away. See registration progress, fee info in LORDS, and get instant confirmation with success toasts. Ranked games now show a trophy badge to distinguish them from sandbox games.",
    type: "feature",
  },
  {
    date: "2026-02-05",
    title: "New Landing Experience",
    description:
      "The landing page has been completely refreshed! Browse and join games directly from the home screen, enjoy beautiful backgrounds that change as you navigate, and access your profile, markets, and leaderboard with the new sidebar. Mobile users get a handy bottom navigation bar.",
    type: "feature",
  },
  {
    date: "2026-01-19",
    title: "Mobile Game Registration",
    description:
      "The game registration flow is now fully responsive. Mobile and tablet users can now select worlds, connect accounts, and create avatars with an optimized touch-friendly interface.",
    type: "improvement",
  },
  {
    date: "2026-01-17",
    title: "Chat Room Subscriptions",
    description:
      "Chat now joins only the room you're viewing, reducing background traffic while keeping messages responsive.",
    type: "improvement",
  },
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
