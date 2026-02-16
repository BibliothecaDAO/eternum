import type { AgentData, EnemyData, FeatureHexData } from "./types";

/** Feature hexes scattered across the grid. */
export const FEATURE_HEXES: FeatureHexData[] = [
  // ── Games (inner ring, 3-5 hex radius) ─────────────────────────────

  {
    coord: { q: -2, r: -2 },
    type: "game",
    symbol: "BLZ",
    label: "Blitz",
    description:
      "Fast-paced onchain RTS where AI agents execute your tactics in real-time. Two-hour matches, fully verified on Starknet.",
    link: "https://blitz.realms.world",
  },
  {
    coord: { q: 4, r: -2 },
    type: "game",
    symbol: "ETR",
    label: "Realms: Eternum",
    description:
      "Grand strategy MMO on Starknet. Build empires, forge alliances, raid resources. A living digital economy with 600+ players.",
    link: "/eternum",
  },
  {
    coord: { q: -3, r: 4 },
    type: "game",
    symbol: "LSV",
    label: "Loot Survivor",
    description:
      "Onchain roguelike with permadeath. Defeat beasts, collect gear, climb the leaderboard. The original Play2Die game with 1,250+ survivors.",
    link: "https://survivor.realms.world/",
  },
  {
    coord: { q: -4, r: 1 },
    type: "game",
    symbol: "DSH",
    label: "Dark Shuffle",
    description:
      "Draft creatures and spells, venture through a map of challenges. Deck-building roguelike by Provable Games.",
    link: "https://darkshuffle.io/",
  },
  {
    coord: { q: 2, r: 3 },
    type: "game",
    symbol: "PAD",
    label: "Pistols at Dawn",
    description:
      "Onchain dueling where every bluff and bullet is etched forever. Challenge friends in atmospheric showdowns by Underware.",
    link: "https://pistols.gg",
  },
  {
    coord: { q: 3, r: -5 },
    type: "game",
    symbol: "BLB",
    label: "Blob Arena",
    description:
      "Turn-based combat where Bloberts clash using Attack, Defence, Speed, and Strength. Enhanced rock-paper-scissors by Grugs Lair.",
    link: "https://www.blobarena.xyz/",
  },
  {
    coord: { q: -1, r: -4 },
    type: "game",
    symbol: "ZKB",
    label: "zKube",
    description:
      "Casual puzzle game playable on mobile. Join daily and monthly tournaments to conquer the leaderboard by zkorp.",
    link: "https://app.zkube.xyz/",
  },

  // ── Infrastructure (mid ring, 6-9 hex radius) ──────────────────────

  {
    coord: { q: 7, r: -3 },
    type: "agent",
    symbol: "DOJO",
    label: "Dojo Engine",
    description:
      "The provable game engine powering every Realms World game. Cairo-based ECS framework for fully onchain worlds.",
    link: "https://dojoengine.org",
  },
  {
    coord: { q: -6, r: 8 },
    type: "agent",
    symbol: "STRK",
    label: "Starknet",
    description:
      "The ZK-rollup L2 where all Realms games live. Validity proofs ensure every game action is mathematically verified.",
    link: "https://starknet.io",
  },
  {
    coord: { q: -7, r: 2 },
    type: "agent",
    symbol: "CART",
    label: "Cartridge",
    description:
      "Session key wallet infrastructure. Play onchain games without signing every transaction. Seamless UX for gamers.",
    link: "https://cartridge.gg",
  },

  // ── Token & DeFi (scattered mid-range) ─────────────────────────────

  {
    coord: { q: 0, r: -7 },
    type: "token",
    symbol: "$LORDS",
    label: "LORDS Token",
    description:
      "The native token uniting the Realms ecosystem. Used for game entry, marketplace trading, DAO governance, and staking rewards.",
  },
  {
    coord: { q: 6, r: 3 },
    type: "token",
    symbol: "veLRD",
    label: "veLORDS Staking",
    description:
      "Lock LORDS to earn protocol revenue. veLORDS holders govern the DAO and earn yield from all ecosystem game fees.",
  },

  // ── DAO & Community (outer ring, 8-12 hex radius) ──────────────────

  {
    coord: { q: -5, r: -4 },
    type: "community",
    symbol: "DAO",
    label: "BibliothecaDAO",
    description:
      "The community DAO governing Realms World since 2021. Treasury stewardship, game funding, and ecosystem direction decided by token holders.",
    link: "https://bibliothecadao.xyz",
  },
  {
    coord: { q: 8, r: -8 },
    type: "community",
    symbol: "FH",
    label: "Frontinus House",
    description:
      "The Realms grants program. Builders pitch proposals, LORDS holders vote, and winning teams get funded to ship onchain games.",
    link: "https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62",
  },

  // ── Lore (deep exploration, 9-12 hex radius) ───────────────────────

  {
    coord: { q: 10, r: -4 },
    type: "lore",
    symbol: "XVI",
    label: "The 16 Orders",
    description:
      "Power, Giants, Titans, Skill, Perfection, Brilliance, Enlightenment, Protection, Anger, Rage, Fury, Vitriol, the Fox, Detection, Reflection, the Twins. Every Realm belongs to one.",
  },
  {
    coord: { q: -8, r: -2 },
    type: "lore",
    symbol: "LOOT",
    label: "The Loot Origin",
    description:
      "It began with 8,000 Loot bags — randomized adventurer gear on Ethereum. From those bags, 8,000 Realms were born. From those Realms, an entire onchain world.",
  },
  {
    coord: { q: -3, r: 11 },
    type: "lore",
    symbol: "RELIC",
    label: "The Scroll Archive",
    description:
      "Every battle, every trade, every hex conquered — permanently inscribed on Starknet. The Realms remember what players forget.",
    link: "/scroll",
  },
];

/** Agent speech phrases — rotated randomly. */
export const AGENT_PHRASES: string[] = [
  "Scouting Eternum territories...",
  "Staking LORDS for veLORDS...",
  "Verifying Cairo proof...",
  "Raiding neighbor's storehouse...",
  "Drafting Frontinus proposal...",
  "Indexing Dojo world state...",
  "Querying Torii for events...",
  "Minting session keys via Cartridge...",
  "Exploring the 16 Orders...",
  "Survivor run: floor 47...",
  "Dark Shuffle draft in progress...",
  "Processing DAO treasury data...",
];

/** Initial agent definitions. */
export const INITIAL_AGENTS: AgentData[] = [
  {
    id: 0,
    coord: { q: 3, r: 1 },
    targetCoord: { q: 3, r: 1 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[0],
    glyph: "E", // Eternum scout
  },
  {
    id: 1,
    coord: { q: -4, r: 2 },
    targetCoord: { q: -4, r: 2 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[1],
    glyph: "S", // Survivor
  },
  {
    id: 2,
    coord: { q: 1, r: -4 },
    targetCoord: { q: 1, r: -4 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[2],
    glyph: "D", // Dojo agent
  },
  {
    id: 3,
    coord: { q: -2, r: 6 },
    targetCoord: { q: -2, r: 6 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[3],
    glyph: "C", // Cartridge agent
  },
];

/** Enemy agents — chase the player. Rendered as "$". */
export const INITIAL_ENEMIES: EnemyData[] = [
  {
    id: 0,
    coord: { q: 10, r: -5 },
    startCoord: { q: 10, r: -5 },
    targetCoord: { q: 10, r: -5 },
    pixelPos: { x: 0, y: 0 },
  },
  {
    id: 1,
    coord: { q: -8, r: 10 },
    startCoord: { q: -8, r: 10 },
    targetCoord: { q: -8, r: 10 },
    pixelPos: { x: 0, y: 0 },
  },
  {
    id: 2,
    coord: { q: -6, r: -6 },
    startCoord: { q: -6, r: -6 },
    targetCoord: { q: -6, r: -6 },
    pixelPos: { x: 0, y: 0 },
  },
];

/** Lore quotes for ambient display. */
export const LORE_QUOTES: string[] = [
  "8,000 bags. 8,000 Realms. One onchain world.",
  "The DAO remembers what individuals forget.",
  "Built on Starknet. Proven by Cairo. Governed by LORDS.",
  "In the beginning, there was the Loot bag.",
  "Every hex conquered is permanently inscribed.",
  "16 Orders. Infinite strategies. One winner.",
];
