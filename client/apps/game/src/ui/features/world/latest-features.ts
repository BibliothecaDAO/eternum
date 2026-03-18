export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
}

export const latestFeatures: LatestFeature[] = [
  {
    date: "2026-03-18",
    title: "Clearer Factory Timeline Cards",
    description:
      "The new Factory now gives its Done, Now, and Next timeline cards different emphasis, making it easier to see what already happened, what matters most, and what comes next.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Softer Blitz Factory Divider",
    description:
      "The new Factory now uses a calmer separator in Blitz mode, so the top controls no longer cut too sharply into the cards below.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Calmer Factory Done State",
    description:
      "Completed games in the new Factory no longer keep saying they are updating automatically, making the finished state feel clearer and less noisy.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Factory Step Notes",
    description:
      "Factory step details now use plain status messages instead of raw launcher wording, so each part is easier to understand while you check a game.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Manual Indexer Restart",
    description:
      "Factory details now include a dedicated indexer action, so you can bring the indexer back online again without rerunning the whole launch.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Waiting State",
    description:
      "The new Factory now shows one clear loading state while a game is starting or recovering, removing the extra repeated badges so it is easier to understand what is happening.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Auto Recovery",
    description:
      "The new Factory now retries failed parts automatically, moves on by itself after a recovery step works, and only stops asking for help after ten automatic tries.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Factory Words",
    description:
      "The new Factory now uses plainer language across launch and watch screens, replacing tool-heavy progress messages with shorter copy that is easier to understand at a glance.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Smarter Factory Relaunch",
    description:
      "Factory recovery now restarts the full launch automatically when the very first launch step fails, instead of forcing you through a step-by-step retry that cannot make forward progress.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Faster Factory Recovery Feedback",
    description:
      "Factory continue and retry actions now switch straight into a working state as soon as the launcher accepts them, so the page no longer leaves the old action button hanging around.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Stronger Factory Live Signal",
    description:
      "The Factory live badge now uses a brighter pulsing green signal so it is easier to tell at a glance when a game is actively being watched.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Live State",
    description:
      "Factory live tracking now shows a clearer pulsing live indicator and hides the extra manual refresh button while updates are already streaming in.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Tighter Factory Picker",
    description:
      "The Factory game picker now uses a smaller floating menu, so switching games feels lighter and takes up less space on the page.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Picker Contrast",
    description:
      "The Factory game picker now uses a clearer floating surface, making the chooser easier to distinguish from the rest of the page while you switch between games.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Game Picker",
    description:
      "The Factory game picker now opens as a floating chooser instead of pushing the page around, making it easier to switch between games without losing your place.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Smoother Factory Launch Tracking",
    description:
      "Factory launch tracking now keeps a new game visible as soon as you start it and stays in a steady waiting state until the first live deployment update arrives.",
    type: "improvement",
  },
  {
    date: "2026-03-06",
    title: "Tournament Leaderboard Table Cleanup",
    description:
      "The Tournaments Score to Beat table now consistently shows only Rank, Player, and Score in the main leaderboard view, removing extra per-game columns from the grid.",
    type: "fix",
  },
  {
    date: "2026-03-06",
    title: "Proving Grounds Static Leaderboard",
    description:
      "The Tournaments Score to Beat leaderboard now supports static proving-grounds data for s0-game-1 through s0-game-4, including per-game points and chest counts for each player when live Torii endpoints are unavailable.",
    type: "feature",
  },
  {
    date: "2026-03-06",
    title: "Tournament Series Selection",
    description:
      "Score to Beat in the Tournaments tab now lets you select either individual games or full series, automatically expanding each series into its indexed games for faster multi-game leaderboard setup.",
    type: "feature",
  },
  {
    date: "2026-03-06",
    title: "Reliable Mainnet Realm Settlement",
    description:
      "Fixed cases where mainnet settlement could stop after the first realm. Settlement now resumes correctly from partial progress and waits for confirmed transactions so all expected realms are created.",
    type: "fix",
  },
  {
    date: "2026-02-18",
    title: "Smoother Worldmap Chunking",
    description:
      "World map chunk prefetching now follows camera direction more accurately and chunk cache sizing is more stable, reducing pop-in and traversal stutter during fast panning.",
    type: "improvement",
  },
  {
    date: "2026-02-17",
    title: "Game Review for Ended Worlds",
    description:
      "Ended games now include a dedicated Game Review flow with final rankings, score highlights, and share-ready recap cards so you can revisit each world after it concludes.",
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
