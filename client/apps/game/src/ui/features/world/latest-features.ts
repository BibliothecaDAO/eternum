export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
  gameSlug?: string;
  readMore?: string;
}

const MAX_LATEST_FEATURES = 8;

const latestFeatureTypePriority: Record<FeatureType, number> = {
  fix: 0,
  feature: 1,
  improvement: 2,
  balance: 3,
};

const compareLatestFeatureDatesDescending = (left: LatestFeature, right: LatestFeature) => {
  const timestampDifference = new Date(right.date).getTime() - new Date(left.date).getTime();
  if (timestampDifference !== 0) return timestampDifference;
  const typePriorityDifference = latestFeatureTypePriority[left.type] - latestFeatureTypePriority[right.type];
  if (typePriorityDifference !== 0) return typePriorityDifference;
  return left.title.localeCompare(right.title);
};

const buildLatestFeaturesFeed = (features: LatestFeature[]) =>
  features.toSorted(compareLatestFeatureDatesDescending).slice(0, MAX_LATEST_FEATURES);

// Curated, deduplicated news feed. Same-day iteration churn and dev-only entries
// are collapsed into single player-facing items; only the latest MAX_LATEST_FEATURES
// are surfaced in the What's New popup.
const allLatestFeatures: LatestFeature[] = [
  {
    date: "2026-06-05",
    title: "Reliable Sync Diagnostics",
    description:
      "Fixed bounded map sync health checks so quiet map areas no longer appear stale just because no tile update arrived, with clearer diagnostics and less redundant subscription churn during connection testing.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Bounded Map Sync",
    description:
      "Added an opt-in bounded world-map sync path so active map areas can receive live updates without processing the full spatial stream.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Army Ghost Cleanup",
    description:
      "Fixed army rendering so stale model bodies are cleared when units switch render state during movement, reducing frozen duplicates on the map.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Compact Realm List",
    description:
      "Fixed the in-game realm list so it shows three rows before scrolling, keeping the production panel visible on laptop screens.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Map Rendering & Graphics Polish",
    description:
      "Fixed world-map rendering so unit models, chests, and the local hex grid stay visible through live updates, chunk transitions, and camera changes; made graphics presets render more cheaply with your saved quality choice now persisting between sessions; and improved Blitz realm setup so fresh realms provision reliably with a tidier realm list.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-05-31",
    title: "Factory Biome Tuning",
    description:
      "Added biome climate tuning to Factory V2 so new games, series, and rotations can preview and adjust terrain seeds before launch.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-05-30",
    title: "Smarter Blitz Suggestions",
    description:
      "Improved Suggested Actions in Blitz so fresh realms start with provision plus level-up, resource hints keep wood, coal, and copper balanced, and build hints autobuild directly when selected.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-29",
    title: "Unified Game Dialogs",
    description:
      "Combat, transfers, market confirmations, and military creation now use consistent draggable windows and shared modal styling across the whole in-game HUD.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-28",
    title: "Combat v3 Ranged Attacks",
    description:
      "Crossbowmen can attack from two hexes with reduced ranged damage, Knights are stronger around structure guards, and structures must still be claimed from an adjacent hex.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-05-27",
    title: "Biome Preview Viewer",
    description:
      "Added a factory biome preview with seed controls so creators can inspect generated terrain before applying world configuration.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-27",
    title: "Biome Climate Controls",
    description:
      "Added factory setup controls for biome climate tuning so new worlds can adjust elevation and moisture generation during configuration.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-05-26",
    title: "Unit Creation Ghosts",
    description:
      "Added unit-shaped creation previews so newly submitted armies appear as ghosts on their spawn hex while the world catches up.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-25",
    title: "Explore Arrival Previews",
    description:
      "Added the travel-style destination ghost and pulsing arrival ring to explore commands, making queued exploration feedback visible immediately.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-23",
    title: "Map Labels & Hover Details",
    description:
      "Restored compact always-on map labels above armies, realms, camps, and key structures, unified them with the detailed hover cards, and made hover details reliably recover after loading and chunk transitions.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-22",
    title: "Clearer Day & Night Cycle",
    description:
      "Improved world lighting so each day phase is easy to read and nights and storms stay legible, with brighter night tones, stronger fill light, and capped weather darkness.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-19",
    title: "Relic Usability Cues",
    description:
      "Army and structure HUD relic tabs now show a usable-vs-total cue, mark empty tabs as disabled, highlight relics that match the selected entity, and surface activatable army relics directly in the HUD.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-18",
    title: "Smoother Map Streaming",
    description:
      "World-map streaming now holds wider live regions, keeps nearby terrain visible while the next chunk hydrates, recovers stalled chunk switches in-session, and reduces blank pop-in during fast travel.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-13",
    title: "Unconstructed Hyperstructures",
    description:
      "Reserved Hyperstructures now appear directly on the map before construction, and you can build them with a double-click or the Create Here action from tile details.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-13",
    title: "Settle Or Spectate",
    description:
      "Blitz game cards now keep spectating alongside settling, so you can preview open worlds before joining and still jump straight into active matches from your game list.",
    type: "improvement",
    gameSlug: "landing",
  },
  {
    date: "2026-05-12",
    title: "Blitz Realm Provisioning",
    description:
      "Blitz realms now enter with a lighter initial setup and show a dedicated in-world provision action beside realm upgrades once the main phase starts, so delayed economy activation is available exactly when it matters.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-12",
    title: "Clearer Tile HUD",
    description:
      "Selected structure and army panels now show tab badges for defenders, production, inventory, and relics so key counts are visible before opening each tab.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-05-11",
    title: "Single-Step Blitz Entry",
    description:
      "Blitz entry now stays centered on one settlement action instead of sending players through the older staged setup flow.",
    type: "improvement",
    gameSlug: "landing",
  },
  {
    date: "2026-04-25",
    title: "Sidebar Transfer Bars",
    description:
      "The realm sidebar now shows minimal transfer bars for active live and automated routes, so you can see what is moving between structures at a glance without reopening the transfers panel.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-04-16",
    title: "Automation Skip Reasons",
    description:
      "Production automation now shows why a realm was skipped, making inactive buildings, missing inputs, and budget limits easier to diagnose.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-04-12",
    title: "Auto-Settle Card Switch",
    description:
      "Blitz registrations now turn on an Auto-settle switch directly on the game card, so the client can prewarm the entry flow, try settling as soon as the countdown ends, and push you into the game automatically unless you switch it off.",
    type: "feature",
    gameSlug: "landing",
  },
  {
    date: "2026-04-12",
    title: "Smoother Army Movement",
    description:
      "Army moves now start as soon as the transaction is submitted and leave a destination ghost that absorbs into the real unit on arrival, so movement stays readable through world-sync delays instead of stalling.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-04-11",
    title: "Canonical Landing Routes",
    description:
      "Landing navigation now uses dedicated URLs for Play, Learn, News, and Factory with a unified game-entry handoff, so shared links, reloads, and network switches stay aligned.",
    type: "improvement",
    gameSlug: "landing",
  },
  {
    date: "2026-03-24",
    title: "Live Agora AMM Dashboard",
    description:
      "The Agora AMM trading dashboard now lives in the main shell with live pools, charts, and trade history, resource icons across the flow, and real swap and liquidity transactions against the Agora contracts.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Research Relic Crafting",
    description:
      "Realm and Village economy panels now support crafting relics directly from research with preflight checks, crafting feedback, and immediate relic inventory refresh.",
    type: "feature",
  },
  {
    date: "2026-03-23",
    title: "Army Spire Traversal",
    description:
      "Armies adjacent to a Spire now get a dedicated Spire action — opening a combat preview against an ethereal defender or a direct travel window into the Ethereal Layer — without forcing the map to switch layers.",
    type: "feature",
  },
  {
    date: "2026-03-20",
    title: "Factory V2 Launch Center",
    description:
      "The landing page now has a full Factory V2 flow for starting a game, checking progress, and recovering pending launches, with Blitz opening first when Factory is idle, calmer progress states, and a layout that holds up much better on mobile.",
    type: "feature",
    gameSlug: "landing",
  },
  {
    date: "2026-03-19",
    title: "Wonder Faith & Devotion",
    description:
      "Wonders now have a dedicated faith detail view and a Faith leaderboard tab ranking wonders by Faith Points, and Realm and Village panels let you devote to a Wonder directly in-game with FP/sec and follower stats.",
    type: "feature",
  },
  {
    date: "2026-02-17",
    title: "Game Review for Ended Worlds",
    description:
      "Ended games now include a dedicated Game Review flow with final rankings, score highlights, and share-ready recap cards so you can revisit each world after it concludes.",
    type: "feature",
  },
  {
    date: "2026-02-05",
    title: "New Landing Experience",
    description:
      "The landing page has been completely redesigned! Browse Live, Upcoming, and Ended games in organized columns, register for games directly from the home screen, and enjoy faster game loading with instant entry that lands you right at your realm.",
    type: "feature",
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
    title: "Prediction Market: Custom Odds",
    description:
      "Create prediction markets with customizable player weights and odds. Select 1-5 players, adjust individual weights, and see real-time percentage chances. The 'None of the above' option is also customizable. Minimum funding reduced to 100 LORDS.",
    type: "feature",
  },
  {
    date: "2026-01-13",
    title: "Transaction Status Center",
    description:
      "A new transaction center is available in the bottom-right corner. Track all your pending, confirmed, and failed transactions in real-time with a status beacon indicator, and click any transaction to view details on Voyager.",
    type: "feature",
  },
  {
    date: "2026-01-09",
    title: "Troop Balance Update",
    description:
      "Paladin stamina has been increased to 120, and mercenary troop bounds have been adjusted to 800-1600 for improved balance.",
    type: "balance",
  },
];

export const latestFeatures = buildLatestFeaturesFeed(allLatestFeatures);
