export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
  gameSlug?: string;
  readMore?: string;
}

const MAX_LATEST_FEATURES = 10;

const compareLatestFeatureDatesDescending = (left: LatestFeature, right: LatestFeature) => {
  const timestampDifference = new Date(right.date).getTime() - new Date(left.date).getTime();
  if (timestampDifference !== 0) return timestampDifference;
  return left.title.localeCompare(right.title);
};

const buildLatestFeaturesFeed = (features: LatestFeature[]) =>
  features.toSorted(compareLatestFeatureDatesDescending).slice(0, MAX_LATEST_FEATURES);

const allLatestFeatures: LatestFeature[] = [
  {
    date: "2026-04-10",
    title: "Resource Action Tick Fix",
    description:
      "Trading, transfers, bridge checks, and realm upgrade requirements now use the live default tick again, so newly produced resources stop waiting on a coarse UI refresh window before they count toward actions.",
    type: "fix",
  },
  {
    date: "2026-04-10",
    title: "Army Stamina Alignment",
    description:
      "World map army labels and selected-army stamina bars now stay aligned more reliably, including passive regen and live troop-state updates that previously drifted apart.",
    type: "fix",
  },
  {
    date: "2026-04-10",
    title: "Structure Ghosting Hardening",
    description:
      "World map structures now discard stale render passes when chunk bounds change mid-update, so old buildings stop flashing onto newly loaded terrain during fast chunk and zoom transitions.",
    type: "fix",
  },
  {
    date: "2026-04-09",
    title: "Biome Card Tightening",
    description:
      "Biome combat cards now use tighter spacing in the world action panel, so troop bonuses stay easier to scan without the terrain section crowding the rest of the tile details.",
    type: "fix",
  },
  {
    date: "2026-04-09",
    title: "Canvas Guard Cleanup",
    description:
      "Game entry no longer carries dead tutorial overlay guards, so the world canvas stops falling into a non-interactive state from stale legacy DOM classes.",
    type: "fix",
  },
  {
    date: "2026-04-08",
    title: "Chunk Structure Sync Fix",
    description:
      "Realm buildings, essence mines, and other structures now stay aligned with chunk streaming more reliably, so landmarks stop disappearing while nearby terrain is still visible during chunk crossings.",
    type: "fix",
  },
  {
    date: "2026-04-07",
    title: "Landing Hub Refresh",
    description:
      "The dashboard News, Learn, and Markets tabs now surface fresher updates, clearer onboarding, and more actionable market stats so you can find the right information faster.",
    type: "improvement",
    gameSlug: "landing",
    readMore: "https://github.com/BibliothecaDAO/eternum/issues/4375",
  },
  {
    date: "2026-04-07",
    title: "Stamina Sync Fixes",
    description:
      "Army and guard stamina now stays aligned with live tick updates more reliably, so combat previews and action gating stop freezing on stale values or jumping to misleading full stamina.",
    type: "fix",
  },
  {
    date: "2026-04-07",
    title: "Chunk Stall Recovery",
    description:
      "World map chunk streaming now traces stalled Torii and hydration handoffs and automatically retries instead of leaving dead chunks stuck until you reload the game.",
    type: "fix",
  },
  {
    date: "2026-04-06",
    title: "Army Ghosting Suppression",
    description:
      "Armies hidden during removal recovery now stay hidden until fresh tile state proves they should return, so stale bodies, ownership dots, and attached visuals stop flashing back onto the world map.",
    type: "fix",
  },
  {
    date: "2026-04-06",
    title: "Smoother Market Boot",
    description:
      "Game entry and landing now avoid kicking off heavyweight prediction-market sync work until those panels actually need it, so world load spends less time competing with failing background market requests.",
    type: "fix",
  },
  {
    date: "2026-04-06",
    title: "Dashboard Network Switch",
    description:
      "The dashboard header now includes a compact network switcher, so you can swap the preferred game chain and prompt a wallet network switch from one cleaner control.",
    type: "improvement",
  },
  {
    date: "2026-04-06",
    title: "Army Recovery Hardening",
    description:
      "Armies that recover from stale removal state now wait for fresh map data before redrawing, and real removals no longer risk flashing a dead unit back onto the world map while recovery work is still in flight.",
    type: "fix",
  },
  {
    date: "2026-04-06",
    title: "Army Ghosting Recovery",
    description:
      "Moving armies now keep their on-map visuals and ownership dots in sync more reliably, and stale removal recovery no longer depends on zooming the camera to make a valid unit reappear.",
    type: "fix",
  },
  {
    date: "2026-04-07",
    title: "Blitz Rank Refresh",
    description:
      "Blitz MMR ranks now use the new Scrapper-to-Storm Lord naming ladder, so leaderboard, profile, and match views all reflect the updated progression language.",
    type: "improvement",
  },
  {
    date: "2026-04-02",
    title: "Unit Command Audio",
    description:
      "Army commands now acknowledge what you actually ordered, with distinct cues for selection, movement, attacks, and exploration instead of relying on one generic unit response.",
    type: "improvement",
  },
  {
    date: "2026-04-01",
    title: "Production Modal Height Restore",
    description:
      "The Production window now grows back to the full game viewport height, so resource controls and per-realm panels stay fully visible instead of being trapped in a cramped scroller.",
    type: "fix",
  },
  {
    date: "2026-03-31",
    title: "Faster World Selection",
    description:
      "Game entry now resolves factory world metadata and Torii profile details in parallel, reducing the time spent waiting on world selection before the world loader can continue.",
    type: "improvement",
  },
  {
    date: "2026-03-31",
    title: "Game Entry Load Trim",
    description:
      "Entering a game now records each load milestone in the browser and defers non-critical world asset prefetch until bootstrap has already started, so the initial handoff spends less time competing with early preload work.",
    type: "improvement",
  },
  {
    date: "2026-03-31",
    title: "Dashboard Settings Crash Fix",
    description:
      "Opening dashboard settings no longer crashes outside the game world, so landing-page audio, graphics, and fullscreen controls now open safely without needing an in-game Dojo context.",
    type: "fix",
  },
  {
    date: "2026-03-31",
    title: "Agora Layout Tightening",
    description:
      "The Agora now gives pool names more room, aligns the pool rail with the main trading panels, and stretches the swap stats cards across the action panel so the page reads more cleanly while you browse and trade.",
    type: "fix",
  },
  {
    date: "2026-03-31",
    title: "Instant Contour Boot Loader",
    description:
      "First load now opens on an instant contour-map splash with a segmented progress bar, so the game no longer flashes a blank white screen while the shell and world loader hand off.",
    type: "improvement",
  },
  {
    date: "2026-03-30",
    title: "Agora Pool Rail Polish",
    description:
      "The Agora pool rail now keeps its own desktop scroll, uses a themed sort control, and trims each pool row down to the essentials so market cap and TVL stay readable while you browse.",
    type: "fix",
  },
  {
    date: "2026-03-30",
    title: "Blitz Army Structure Lock",
    description:
      "Army transfer windows now immediately explain when Blitz blocks returns into camps, rifts, or hyperstructures, and when army-to-army swaps cross realm boundaries, so invalid troop moves are clear before you try to confirm them.",
    type: "fix",
  },
  {
    date: "2026-03-30",
    title: "Agora Pool Review Pass",
    description:
      "The Agora pool rail now defaults to a curated resource order, shows spot price, market cap, and TVL more clearly, and keeps pool browsing scrollable without losing the active trading panels.",
    type: "improvement",
  },
  {
    date: "2026-03-30",
    title: "World Map First Entry",
    description:
      "Entering a game now opens on the world map centered on your realm instead of dropping straight into local realm view, so first load starts with broader context.",
    type: "fix",
  },
  {
    date: "2026-03-30",
    title: "Dashboard Music Picker",
    description:
      "The landing dashboard now includes a compact music player with per-route song picks, quick mute and skip controls, and a smoother handoff into game playlists when you enter a match.",
    type: "improvement",
  },
  {
    date: "2026-03-30",
    title: "Torii Stream Timeout Recovery",
    description:
      "World map chunk streaming now times out and cleans up stuck Torii subscription handoffs, so chunk traversal can recover from a bad stream swap instead of locking the map in place.",
    type: "fix",
  },
  {
    date: "2026-03-30",
    title: "Chunk Swap Stall Fix",
    description:
      "World map chunk swaps no longer wait on unrelated live tile and structure stream traffic, so traversal keeps moving even when the destination area is busy.",
    type: "fix",
  },
  {
    date: "2026-03-29",
    title: "Biome Bonus Card Refresh",
    description:
      "Biome tile panels now show army bonuses as clearer side-by-side combat cards, making troop advantages, penalties, and neutral terrain much faster to scan before a battle.",
    type: "improvement",
  },
  {
    date: "2026-03-28",
    title: "Blitz Breakdown Precision",
    description:
      "Finalized Blitz leaderboard rows now keep decimal precision in each activity column, so the category point values line up visually with the final total instead of rounding whole columns up to the nearest thousand.",
    type: "fix",
  },
  {
    date: "2026-03-28",
    title: "Finalized Blitz Point Columns",
    description:
      "The in-game Blitz Players table now removes live hyperstructure share points from the held-points column after final rankings lock, so the per-row breakdown matches the finalized prize standings.",
    type: "fix",
  },
  {
    date: "2026-03-28",
    title: "Blitz Leaderboard Alignment",
    description:
      "The in-game Blitz Players leaderboard now follows the same finalized rank and score order as the prize panel once rankings are locked, so both panels show the same standings.",
    type: "fix",
  },
  {
    date: "2026-03-27",
    title: "AMM Market Cap Summary",
    description:
      "The Agora AMM summary now shows each selected resource's market cap in LORDS, and the pool rail can be reordered by market cap, resource ID, or TVL so you can scan markets the way you want.",
    type: "improvement",
  },
  {
    date: "2026-03-26",
    title: "Agora Fee Split Labels",
    description:
      "The Agora now shows LP fees and protocol fees as separate values in the pool and swap panels, so the displayed fee split matches the live RealmsSwap economics instead of treating the full trade fee as LP revenue.",
    type: "fix",
  },
  {
    date: "2026-03-26",
    title: "Stabilized Hex Right-Clicks",
    description:
      "Worldmap actions now keep responding on highlighted hexes after fast local-to-world transitions and after entering a different game, without needing a full page refresh.",
    type: "fix",
  },
  {
    date: "2026-03-26",
    title: "Realm Upgrade Sync Lock",
    description:
      "Realm upgrade buttons now stay pending until the transaction fails or the synced realm level catches up, avoiding duplicate upgrade clicks while backend data is still refreshing.",
    type: "fix",
  },
  {
    date: "2026-03-26",
    title: "Mode-Isolated Game UI",
    description:
      "Blitz and Eternum interfaces now stay isolated by world mode: Faith-only panels are hidden in Blitz, Blitz Prize/MMR tabs are hidden in Eternum, and unknown-mode game cards stay in a neutral detecting state until mode resolves.",
    type: "fix",
  },
  {
    date: "2026-03-26",
    title: "Unified Hex Biome Lighting",
    description:
      "Biome tiles now use a consistent surface style instead of mixing random lit and unlit variants, making the world map easier to read at a glance.",
    type: "fix",
  },
  {
    date: "2026-03-26",
    title: "Passive Army Stamina Refresh",
    description:
      "Army stamina shown above units now keeps updating after chain-time corrections instead of waiting for another army action to refresh the display.",
    type: "fix",
  },
  {
    date: "2026-03-26",
    title: "Instant Explorer Map Pins",
    description:
      "Auto-Explore now enables the explorer location shortcut as soon as a new automation entry appears, instead of waiting for the next position refresh cycle.",
    type: "fix",
  },
  {
    date: "2026-03-25",
    title: "Zero-Cost Relic Crafting",
    description:
      "Craft Relic now allows worlds with zero research craft cost to proceed normally, showing explicit zero-cost values instead of blocking with unavailable-config messaging.",
    type: "fix",
  },
  {
    date: "2026-03-25",
    title: "Live Relic Cost Config",
    description:
      "Craft Relic now reads research cost from live world artificer config instead of static network defaults, so misconfigured worlds clearly show crafting cost as unavailable rather than a misleading zero.",
    type: "fix",
  },
  {
    date: "2026-03-25",
    title: "Research Production Visibility Fix",
    description:
      "Research now stays visible in economy tables and structure balance strips, and correctly appears as active production in settlement/economy views with live projected balance updates; structure panels now also backfill missing research fields from SQL when Torii model payloads omit them.",
    type: "fix",
  },
  {
    date: "2026-03-24",
    title: "Dashboard Agora Refresh",
    description:
      "The Agora now lives inside the main dashboard shell with a denser pool rail, resource icons across the trading flow, and tighter stats cards so you can scan markets and act without the old standalone page clutter.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Standalone Agora Preview",
    description:
      "The Agora dashboard now boots with standalone defaults, resolves mainnet resource names for pooled assets, and can connect to a seeded local preview indexer without Blitz or Eternum-specific env setup.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Agora Sidebar Shortcut",
    description:
      "Added a dedicated Agora button to the main dashboard side menu so you can open the Agora dashboard directly from the landing UI.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Auto Name During Settlement",
    description:
      "Realm and village settlement now automatically include your player name setup in the same wallet transaction when your address has no in-game name yet, avoiding extra manual steps.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Relic Crafting UX Polish",
    description:
      "Craft Relic now shows a clearer requirement checklist, research progress, and stronger result feedback, with more visible forge actions in resource tables and chips.",
    type: "improvement",
  },
  {
    date: "2026-03-24",
    title: "Research Relic Crafting",
    description:
      "Realm and Village economy panels now support crafting relics directly from research with preflight checks, crafting feedback, and immediate relic inventory refresh.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Spire Uses Layer Toggle Call",
    description:
      "Improved Spire traversal so the client uses the dedicated layer-toggle contract flow for cross-layer movement through adjacent Spires.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Live Agora Dashboard",
    description:
      "The new Agora dashboard now loads real pools, charts, and trade history from the configured indexer and sends swap and liquidity transactions against the live Agora contracts instead of preview scaffolding.",
    type: "feature",
  },
  {
    date: "2026-03-23",
    title: "Spire Travel Keeps Map Layer",
    description:
      "Fixed Spire travel so moving to the other layer no longer forces the worldmap view to switch layers, keeping your current tactical map context on screen.",
    type: "fix",
  },
  {
    date: "2026-03-23",
    title: "Army Spire Traversal Action",
    description:
      "Armies adjacent to a Spire now get a dedicated Spire action highlight; selecting it opens combat preview if an ethereal defender is present, or a direct travel window into the Ethereal Layer.",
    type: "feature",
  },
  {
    date: "2026-03-23",
    title: "Removed Light Test Dropdown",
    description:
      "Removed the temporary top-header light override selector so world lighting follows the live cycle only, keeping gameplay UI focused and less cluttered.",
    type: "fix",
  },
  {
    date: "2026-03-23",
    title: "Clearer Dusk vs Evening",
    description:
      "Dusk now stays warmer while Late Evening shifts cooler with stronger moon-rim separation, making both phases easier to tell apart without sacrificing map readability.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Moon Rim Night Separation",
    description:
      "Night lighting now adds a cool moon rim directional pass so units and structures separate better from the terrain without flattening daytime lighting.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Cooler Night Color Grade",
    description:
      "Night and late-evening lighting now shift to cooler blue tones with lower saturation instead of relying on darkness alone, making time-of-day changes clearer without hurting visibility.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Brighter Late Evening Override",
    description:
      "Moved the Late Evening light-test point closer to dusk so this phase remains readable while still feeling distinct from daylight.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Brighter Night Visibility Floor",
    description:
      "Adjusted deep-night and evening lighting baselines to preserve day-phase contrast while keeping late-cycle gameplay readable instead of dropping into near-black visibility.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Brighter Late Evening Test",
    description:
      "Adjusted the Late Evening light-test preset to sit closer to dusk so evening validation is easier without dropping into near-night darkness.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Brighter Edge Phase Lighting",
    description:
      "Adjusted Early Hours and Late Evening light-test presets so those two phase overrides stay brighter and easier to inspect while validating world readability.",
    type: "improvement",
  },
  {
    date: "2026-03-23",
    title: "Light Phase Test Selector",
    description:
      "Added a top-header light phase selector so you can force Early Hours, Dawn, Morning, Afternoon, Dusk, or Late Evening lighting while validating world visibility and atmosphere.",
    type: "feature",
  },
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

export const latestFeatures = buildLatestFeaturesFeed(allLatestFeatures);
