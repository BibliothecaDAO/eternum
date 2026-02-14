export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
}

export const latestFeatures: LatestFeature[] = [
  {
    date: "2026-02-13",
    title: "Referral Dashboard + Wallet Capture",
    description:
      "Added a referral program panel to the wallet dashboard with personal link sharing, personal stats, and a top leaderboard. Referral links are now captured from URL and auto-submitted once a wallet connects.",
    type: "feature",
  },
  {
    date: "2026-02-12",
    title: "Building Cost Visual Feedback",
    description:
      "Missing resources in building construction costs now appear in red, making it easier to identify what resources you need to gather before building.",
    type: "improvement",
  },
  {
    date: "2026-02-11",
    title: "Unit Selection Recovery After Moves",
    description:
      "Fixed a case where moved units could become unselectable after rapid chunk camera jumps by automatically recovering stale movement locks and refreshing map state.",
    type: "fix",
  },
  {
    date: "2026-02-11",
    title: "Stable Chunk Refresh Recovery",
    description:
      "Fixed a world map issue where terrain could disappear after rapid cross-chunk movement, so map rendering now recovers automatically without requiring a full reload.",
    type: "fix",
  },
  {
    date: "2026-02-09",
    title: "In-Game Leaderboard Live Updates",
    description:
      "Hyperstructure leaderboard points now refresh automatically while you play, so rankings stay current without reloading or switching tabs.",
    type: "fix",
  },
  {
    date: "2026-02-09",
    title: "Auto-Refreshing MMR Leaderboard",
    description:
      "The Ranked leaderboard now refreshes automatically in the background, so standings update without needing to click Refresh.",
    type: "fix",
  },
  {
    date: "2026-02-05",
    title: "New Landing Experience",
    description:
      "The landing page has been completely redesigned! Browse Live, Upcoming, and Ended games in organized columns. Register for games directly from the home screen. Faster game loading with instant entry - you'll land right at your realm. Mobile users get a new hamburger menu and contextual bottom tabs that change based on your current section.",
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
