export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
}

export const latestFeatures: LatestFeature[] = [
  {
    date: "2026-03-23",
    title: "Village Militia Claim Hides",
    description:
      "Fixed village timers so once militia is claimed, the claim action disappears instead of staying available for another click.",
    type: "fix",
  },
  {
    date: "2026-03-23",
    title: "Tribe Controls Spacing Polish",
    description:
      "Refined Tribe action controls with cleaner button/icon spacing and sizing, including a clearer create-tribe form flow and tighter Members/Invites action alignment in the detail panel.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Tribe Leaderboard Visual Sync",
    description:
      "Tribe rankings and tribe detail panels now share the same modern leaderboard styling language as Players, including refreshed row cards, cleaner headers, and a more consistent member/invite detail layout.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Devotion Split Card Refresh",
    description:
      "Faith Devotion tiles now show a dedicated devoted-wonder chip, You vs Owner FP/sec cards, and a visual split bar with direct Change Devotion and View Wonder actions.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Faith Tile Mobile Readability",
    description:
      "Wonder faith details on compact structure tiles now prioritize Total FP on its own row and use denser stat labels, so key values like Followers stay legible on smaller screens.",
    type: "fix",
  },
  {
    date: "2026-03-23",
    title: "Stable First Map Camera",
    description:
      "World map now opens in its intended tactical camera framing on the first load, so it no longer starts in a close-up offset view before settling after a scene switch.",
    type: "fix",
  },
  {
    date: "2026-03-22",
    title: "Less Skewed Map Camera",
    description:
      "World map now uses a narrower camera field of view and a steadier tilt curve across zoom bands, so the map reads more like a tactical RTS view and less like an exaggerated perspective shot.",
    type: "improvement",
  },
  {
    date: "2026-03-22",
    title: "Hidden Map Hex Fill",
    description:
      "World map interaction now keeps the hex hover outline without rendering the filled green interaction surface, so the map no longer shows a chunk-shaped overlay on top of the terrain.",
    type: "fix",
  },
  {
    date: "2026-03-22",
    title: "Simpler Map Ground",
    description:
      "World map ground now uses a flat backdrop instead of the paper texture, making it easier to spot whether terrain chunk shading differences are coming from the terrain layer itself.",
    type: "improvement",
  },
  {
    date: "2026-03-22",
    title: "Tactical Map Camera Tilt",
    description:
      "World map camera bands now tilt more consistently as you zoom out, so far views read more like a tactical map instead of flattening and then pitching back down.",
    type: "improvement",
  },
  {
    date: "2026-03-22",
    title: "Stable Worldmap Zoom",
    description:
      "World map zoom now runs through one smoother camera system for mouse wheel, minimap zoom, and keyboard shortcuts, so focus points stay steadier and zoom-driven refreshes stop fighting each other.",
    type: "improvement",
  },
  {
    date: "2026-03-21",
    title: "Smarter Factory Recovery",
    description:
      "Factory V2 now waits to show Continue until a launch has genuinely gone stale, so the recovery button no longer flashes during normal setup step transitions.",
    type: "fix",
  },
  {
    date: "2026-03-21",
    title: "Factory Dev Panel Polish",
    description:
      "Factory V2 developer tools now put contract lookup first, keep factory config multicalls much more compact, and prompt for a wallet network switch before sending config on the wrong chain.",
    type: "improvement",
  },
  {
    date: "2026-03-21",
    title: "Factory Config Multicall",
    description:
      "Factory V2 now hides a developer factory-config panel that lets you batch selected set_factory calls into one wallet multicall, so advanced setup changes are faster and easier to manage.",
    type: "feature",
  },
  {
    date: "2026-03-21",
    title: "Factory Mainnet Launch Recovery",
    description:
      "Factory V2 now supports mainnet launch workflows again and automatically turns on gas coverage after mainnet game setup, so new worlds can come online without a separate paymaster sync.",
    type: "feature",
  },
  {
    date: "2026-03-21",
    title: "Factory Dev Contract Lookup",
    description:
      "Factory V2 now hides a developer lookup panel that can resolve prize and custom manifest contract addresses directly from the factory indexer, without waiting for a game indexer to come online.",
    type: "feature",
  },
  {
    date: "2026-03-20",
    title: "Pending Launch Reload Fix",
    description:
      "Factory V2 now caches a launch as soon as you start it, so reloading the page still keeps that game visible while it is coming online.",
    type: "fix",
  },
  {
    date: "2026-03-20",
    title: "Blitz Reward Preview",
    description:
      "Factory V2 now shows the active Blitz exploration reward table for the selected duration, so you can see the exact reward mix before you launch.",
    type: "improvement",
  },
  {
    date: "2026-03-20",
    title: "Factory V2 Launch Center",
    description:
      "The landing page now has a full Factory V2 flow for starting a game, checking progress, and recovering pending launches, with Blitz opening first when Factory is idle, calmer progress states, and a layout that holds up much better on mobile.",
    type: "feature",
  },
  {
    date: "2026-03-19",
    title: "Stable Biome Chunk Refresh",
    description:
      "Fixed world map biome flicker during chunk refreshes and rapid traversal, so terrain updates stay visually stable while nearby tiles and managers catch up.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "FP Wallet Chip Removed",
    description:
      "Removed the experimental FP Wallet chip from the top header to keep entity and resource UI focused on core in-panel faith metrics.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Faith Panel Overflow Fix",
    description:
      "Adjusted Wonder faith cards in compact entity details so all key stats remain visible without clipping, and enabled scrolling in the full Faith tab when content is taller than the panel.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Wonder Faith Detail Views",
    description:
      "Wonders now have a dedicated faith detail view from both map tiles and the Faith leaderboard, with ownership, FP rates, and follower details in a dedicated modal panel.",
    type: "feature",
  },
  {
    date: "2026-03-19",
    title: "Auto World Mode Detection",
    description:
      "Fixed game startup so Blitz and Eternum mode are detected from each world's onchain config instead of requiring a forced environment mode flag.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Stable Leaderboard Refresh",
    description:
      "Fixed in-game leaderboard refresh behavior so standings no longer collapse and redraw during periodic sync updates.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Faith Total FP Estimation",
    description:
      "Faith leaderboard Total FP now includes estimated unclaimed points from each Wonder's current FP/sec, so rankings reflect live devotion growth between contract claims.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Wonder Devotion Actions",
    description:
      "Realm and Village panels now let you view current faith allegiance and devote to a Wonder directly in-game, including wonder FP/sec and follower stats before confirming.",
    type: "feature",
  },
  {
    date: "2026-03-18",
    title: "Faith Wonder Leaderboard Tab",
    description:
      "Added a new Faith tab to the in-game leaderboard that ranks all Wonders by accumulated Faith Points, including FP/sec, follower counts, and owner details.",
    type: "feature",
  },
  {
    date: "2026-03-19",
    title: "Blitz Research Lab Preview Fix",
    description:
      "Fixed Blitz construction previews so the Research Lab no longer appears in building options for Blitz games.",
    type: "fix",
  },
  {
    date: "2026-03-18",
    title: "1v1 Capacity Display Fix",
    description:
      "Blitz 1v1 game cards and registration checks now use the true two-player cap, so the lobby count and Register availability stay aligned with onchain settlement limits.",
    type: "fix",
  },
  {
    date: "2026-03-17",
    title: "Spire and Mine Tile Actions",
    description:
      "Selected tile interactions now handle Spires with a direct Ethereal Layer travel action, show Holy Site devotion placeholders, and keep mine naming consistent across Blitz and Eternum views.",
    type: "feature",
  },
  {
    date: "2026-03-17",
    title: "Eternum Settlement Card Stats",
    description:
      "Eternum game cards now show settled-player counts plus settled realm and village totals, so card stats stay meaningful for worlds that do not use player registration.",
    type: "improvement",
  },
  {
    date: "2026-03-17",
    title: "Infinite Season Timer Fix",
    description:
      "Fixed infinite sandbox worlds so the header no longer shows a 0h end countdown or urgent red flashing, and the End season leaderboard action is now hidden when a season has no end timestamp.",
    type: "fix",
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
