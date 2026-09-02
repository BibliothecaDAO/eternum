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
    date: "2026-09-02",
    title: "Licensed Icy Sky Dragon",
    description:
      "Replaced the temporary Sky Dragon test model with a licensed icy dragon, preserving procedural walking, flight, reactions, and targeted fire breath with clearer textures and a production-safe source.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Terrain-Aware Movement Trails",
    description:
      "Added lightweight dust puffs behind moving ground armies, with stronger trails on dry land, softer trails through grass and forest, and no dust over snow, water, or beneath flying units.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Organic Coastal Water",
    description:
      "Improved oceans with sub-hex shorelines, shallow turquoise margins, deeper offshore color, moving wave highlights, beach foam, boat wakes, and idle ripples.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Living Landscape Edges",
    description:
      "Added grassy road verges, wetland shoreline growth, close-up ferns, reeds and wildflowers, and settlement footprints that respond to each structure's type and level.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Settlement Regrowth Zones",
    description:
      "Improved land around settlements with disturbed soil, cleared mature growth, pioneer shrubs and birch, and natural rings of stumps and fallen timber.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Living Road Networks",
    description:
      "Added natural roads between nearby structures under the same owner, with routes that avoid water and clear vegetation while blending into the surrounding landscape.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-31",
    title: "More Natural Forest Landscapes",
    description:
      "Improved forests with mature groves, regenerating edges and clearings, layered canopy, understory and deadfall, better-spaced crowns, and ground cover that responds to the canopy above.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Secure Match Chat",
    description:
      "Blitz chat now opens only for signed-in match participants, with private presence and protected direct messages.",
    type: "improvement",
    gameSlug: "blitz",
  },
  {
    date: "2026-08-30",
    title: "Exact Blitz Results",
    description:
      "Blitz reviews now show the exact final rank and chest entitlement recorded by the game, with LORDS and MMR settled safely on Starknet mainnet.",
    type: "improvement",
    gameSlug: "blitz",
  },
  {
    date: "2026-08-28",
    title: "Clearer World Loading",
    description:
      "World entry now shows real sync progress and waits for biome terrain before revealing the map, while slow loads expose the stage that is still working.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-28",
    title: "Faster Exploration Reveal",
    description:
      "Explored terrain and fog now update as one streamed action, so newly discovered tiles appear immediately and reveal smoothly.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-28",
    title: "Independent Game Entry",
    description:
      "Game lists, settlement, and spectating now load directly from Herald, keeping entry available when the legacy indexer is offline.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-28",
    title: "Reliable Realm Building",
    description:
      "Building actions now prevent duplicate placements while one is submitting, and the in-game connection banner follows the active gameplay account.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Smooth Sky Dragon Rendering",
    description:
      "Improved Sky Dragon frame rates by removing their costly animated real-time shadows while preserving the complete model, textures, and procedural motion.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Opaque Sky Dragon Materials",
    description:
      "Fixed Sky Dragon body, limb, eye, and wing materials so their textures render completely instead of appearing patchy or transparent.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Sky Dragon Flight Travel",
    description:
      "Improved Sky Dragons so they stand directly on the terrain while resting, take off for army movement, remain airborne along the route, and land at their destination.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Swappable Mount Models",
    description:
      "Added mount appearance and rig selection to the animation Gym, with live asset and skeleton diagnostics for reviewing horses, warhorses, and dragons safely.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Aligned Exploration Fog",
    description: "Fixed exploration fog appearing on the wrong hexes by aligning its mask with the world map.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-26",
    title: "Reliable Realm Entry",
    description:
      "Realm actions now submit in order with automatic nonce recovery, while signed-out visitors stay read-only until they connect an identity.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-26",
    title: "Faster Madara Actions",
    description:
      "Madara actions now submit without a fee-estimation round trip, reducing delays before they reach the chain.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Responsive Terrain Exploration",
    description:
      "Fixed delayed biome streaming and misplaced exploration fog so terrain appears as the map moves and mist stays aligned with unexplored hexes.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Procedural Naval Combat",
    description:
      "Added fantasy ships that take over when armies enter water, with synchronized wave motion, team pennants, wakes, cannonball broadsides, and impact-driven sinking—all tunable in the animation Gym.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Swappable Character Rigs",
    description:
      "Added explicit appearance and skeleton adapters so procedural movement, equipment, diagnostics, and ragdolls can drive different compatible fantasy character models without duplicating animation code.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Natural Human Footing",
    description:
      "Improved procedural walking and running with human-proportioned step width, forward-tracking knees, and new gait diagnostics that prevent bow-legged movement from reaching battles.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Integrated World Gym",
    description:
      "Added a shared biome-and-army test map where 100 procedural units walk across generated terrain with live grounding, collision, renderer, and performance diagnostics.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Stable Character Footwork",
    description:
      "Fixed boots twisting or facing backward during procedural movement, keeping toes aligned with travel while planted steps and swing transitions remain stable.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Living Fog Frontier",
    description:
      "Undiscovered territory now settles beneath softly moving mist, keeping biome ground faintly readable below it with a clearer one-tile frontier near explored land.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Physical Army Reactions",
    description:
      "Armies now separate and react when they meet, while targeted arrows preserve their incoming direction through authoritative Jolt ragdoll handoff. A seven-scenario collision gym and the 100-unit performance lab guard the behavior.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Stable Mounted Characters",
    description:
      "Fixed horses rubber-banding toward their staging origin while loading and stretching during Jolt ragdolls or resets, preserving stable legs through spawn, movement, death, and respawn.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "More Natural Unit Gaits",
    description:
      "Improved walking and running with planted-foot transitions, support-driven weight shifts, distinct run compression and flight, earlier leg recovery, calmer walking clearance, and more natural arm carriage.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "100-Unit Performance Lab",
    description:
      "Added a repeatable 60 FPS walking benchmark with live CPU, GPU, frame-pacing, draw-call, triangle, animation-lane, and display-refresh diagnostics for tuning large procedural armies.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Procedural Armies",
    description:
      "Replaced land-army board models with generated Knights, Archers, Crossbowmen, and mounted Paladins that share the new locomotion, weapon, attack, cosmetic, and ragdoll pipeline.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Exploration Shroud",
    description:
      "Unknown territory now forms a continuous atmospheric shroud that inherits subtle color from discovered biomes and recedes organically when your armies reveal new land.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Living Terrain Detail",
    description:
      "Improved every biome with broader landforms, richer forest layers, moving vegetation, animated coastal water, and terrain detail that adapts smoothly as you zoom.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Textured Living Biomes",
    description:
      "Added seamless ground materials across every biome, with natural grass, sand, soil, forest litter, stone, snow, and scorched-earth detail that follows climate and terrain shape.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Full-Scale Biome Testing",
    description:
      "Expanded procedural terrain verification to a full-screen, 100-page traversal and increased forest abundance while keeping large biome views smooth across both renderers.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Organic Biome Density",
    description:
      "Forests, rocks, and ground cover now gather in natural seeded clusters, blend across biome edges, thin on steep ground, and leave breathing room around structures.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Living Procedural Biomes",
    description:
      "The world map now flows as continuous terrain with organic forests, coastlines, relief, and structure pads while preserving exact hex interactions.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Believable Weapon Grips",
    description:
      "Fixed weapon, shield, bow, and crossbow holds with palm-aware sockets, role-specific finger poses, shield clearance, and close-up grip diagnostics for more convincing combat animation.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Animation Frame Inspector",
    description:
      "Added deterministic frame capture, five-angle phase atlases, numbered joint and angle overlays, pose diagnostics, contact sheets, and exact timeline scrubbing for validating characters and mounts before live battles.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Procedural Melee Combat",
    description:
      "Added grounded and mounted weapon attacks with swappable sword, hammer, axe, and shield cosmetics, target-contact feedback, and the same Jolt ragdoll handoff used by live armies.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Procedural Archery",
    description:
      "Added organic longbow draw and release motion, visible arrow volleys, moving-target practice controls, and pooled projectile impacts that preserve authoritative combat outcomes.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Organic Procedural Locomotion",
    description:
      "Improved soldiers, horses, and mounted riders with planted contacts, anatomically correct horse footfalls, terrain-aware balance, natural follow-through, and subtle per-unit gait variation.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-21",
    title: "Procedural Mounted Armies",
    description:
      "Added procedural horses and mounted Paladins with speed-driven gaits, terrain-aware hooves, visible upgrade pieces, composed riders, and shared Jolt ragdolls, plus mixed 100-unit gym benchmarks before promotion into live battles.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Accurate Army Stamina",
    description:
      "Army map labels now use the same current stamina tick as the selected-army panel, keeping both displays in sync.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster First Settlement View",
    description:
      "Settlement textures now prepare during idle map time on supported desktops, reducing local-view pauses once the background warmup completes.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Current-Game Leaderboard",
    description:
      "Fixed the in-game Blitz leaderboard so it shows only players registered in the current match, including players who have not scored yet.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster World Entry",
    description:
      "The entry screen now clears as soon as the critical map terrain and entities are ready, while remaining map detail continues loading in the background.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Smoother Terrain Travel",
    description:
      "Map travel now reuses terrain already being prepared before drawing a temporary fallback, reducing late terrain swaps during fast pans.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Map Travel",
    description:
      "Map travel now updates only the armies and structures entering or leaving view, instead of rebuilding everything already on screen.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Smoother Map Hover",
    description:
      "Map hover effects now update at most once per frame and skip unchanged tiles, reducing cursor-driven frame work without affecting clicks or selections.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Building Updates",
    description:
      "Building placements and removals now update only the affected local tile, keeping settlements responsive without rebuilding surrounding terrain.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Reliable Terrain Colors",
    description:
      "Terrain color buffers now exist from the first frame, preventing late tint updates from being missed or shared across scenes.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Reliable Session Recovery",
    description:
      "Slow account restoration now stays in progress, while manual account reconnects show a bounded attempt, clear errors, and a safe retry.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Scene Changes",
    description:
      "World and local view setup now runs during the transition fade, reducing the wait before the next scene appears.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Uninterrupted Map Travel",
    description:
      "Routine zooming and terrain updates no longer dim the world, while genuine terrain recovery stays visible as a compact status.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Game Entry",
    description:
      "Game code and assets now begin loading as soon as you enter a play route, reducing waits even when account restoration is slow.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Reliable Game Entry",
    description:
      "Game entry now mounts the world once, preventing duplicate startup work and lost readiness while the world loads.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-17",
    title: "Live World Facts",
    description:
      "Army movement, battle previews, terrain, transfers, and game-entry progress now follow live indexed state, preventing stale displays, submissions, and fixed-delay waits.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Reliable Battle Results",
    description:
      "Missed crate reveals and combat effects now recover automatically after brief connection interruptions.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Instant Building Placement",
    description:
      "New buildings now appear as soon as placement is submitted, while successful army moves stay at their destination and unlock promptly after confirmation.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Action-Ready Armies and Chests",
    description:
      "Armies unlock as soon as movement confirms, realm provisioning appears in one step, and relic chests recover their reveal even if the live event connection drops.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Faster Reliable World Entry",
    description:
      "Fixed long world-entry warm-up stalls and made returns from Hexception recover dropped map refreshes automatically, without needing a camera or URL nudge.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Battery-Friendly Rendering",
    description:
      "Added Quality and Battery modes with identical visuals. Battery mode lowers background frame, animation, shadow, and map-prefetch work while the game is idle, then resumes immediately when you interact.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Faster World Rendering",
    description:
      "Improved model loading, distant terrain detail, and map updates so entering, zooming, traveling, and returning to the world use less memory with fewer frame stalls or terrain pop-ins.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-14",
    title: "Live In-Game Rankings",
    description:
      "Fixed the rank pill and leaderboard totals so they update from live game state, while activity history refreshes on demand without background polling.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-14",
    title: "Reliable Map Armies",
    description:
      "Fixed armies so movement, creation, and defeat stay current across the world map without stale units or camera-driven repair fetches.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-14",
    title: "Reliable Map Structures",
    description:
      "Fixed structures so new realms, upgrades, and Hyperstructure sites appear and stay current immediately without leaving and returning to the area.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-13",
    title: "Reliable Map Chests",
    description:
      "Fixed relic chests so discoveries, moves, and removals stay current while you pan around the world map without an extra area fetch.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-13",
    title: "Whole-World Live Sync",
    description:
      "Improved map synchronization so offscreen armies, structures, resources, and chests stay current and are ready when you move the camera, including after reconnecting.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-13",
    title: "Instant Chest Rewards",
    description:
      "Fixed relic-crate rewards so an open army panel receives the new relic immediately without requiring a refresh or reselect.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Lighter Structure Sync",
    description:
      "Improved owned-structure sync so bursts of ownership updates share a single backfill pass, reducing repeated data fetches while keeping new realms live.",
    type: "improvement",
    gameSlug: "world",
  },
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
