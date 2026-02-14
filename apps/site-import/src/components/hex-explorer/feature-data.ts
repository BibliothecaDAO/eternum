import type { AgentData, EnemyData, FeatureHexData } from "./types";

/** Feature hexes scattered across the grid. */
export const FEATURE_HEXES: FeatureHexData[] = [
  // Game portals — closest to spawn
  {
    coord: { q: 4, r: -2 },
    type: "game",
    symbol: "BLITZ",
    label: "Loot Survivor Blitz",
    description:
      "Fast-paced onchain survival. AI agents battle permadeath dungeons in 5-minute rounds.",
    link: "/blitz",
  },
  {
    coord: { q: -3, r: 5 },
    type: "game",
    symbol: "ETERNUM",
    label: "Eternum",
    description:
      "Grand strategy MMO. Build empires, forge alliances, conquer hexes. Fully onchain on Starknet.",
    link: "/eternum",
  },

  // Lore fragments — mid-range (8-12 hex radius)
  {
    coord: { q: 8, r: -3 },
    type: "lore",
    symbol: "LORE",
    label: "The Orders",
    description: "16 orders. One world. Infinite agents.",
  },
  {
    coord: { q: -6, r: -4 },
    type: "lore",
    symbol: "LORE",
    label: "On-Chain Genesis",
    description:
      "The Realms were forged in the fires of on-chain permanence.",
  },
  {
    coord: { q: -2, r: 10 },
    type: "lore",
    symbol: "LORE",
    label: "Hex Stories",
    description: "Every hex holds a story. Every agent writes a new one.",
  },

  // AI / Agent hexes
  {
    coord: { q: 6, r: 2 },
    type: "agent",
    symbol: "AI",
    label: "Agent Nexus",
    description:
      "Autonomous agents explore, trade, and battle. The grid is alive with intelligence.",
  },
  {
    coord: { q: -7, r: 3 },
    type: "agent",
    symbol: "AI",
    label: "Agent Protocol",
    description:
      "Every agent action is verified onchain. Transparent, trustless, autonomous.",
  },

  // Token hex
  {
    coord: { q: 0, r: -6 },
    type: "token",
    symbol: "$LORDS",
    label: "LORDS Token",
    description:
      "The native token of the Realms ecosystem. Earned by agents, staked by players.",
  },

  // Community / DAO hex
  {
    coord: { q: -5, r: -1 },
    type: "community",
    symbol: "DAO",
    label: "BibliothecaDAO",
    description:
      "The DAO remembers what individuals forget. Community-governed onchain worlds.",
    link: "https://bibliothecadao.xyz",
  },
];

/** Agent speech phrases — rotated randomly. */
export const AGENT_PHRASES: string[] = [
  "Scouting new territories...",
  "Analyzing $LORDS market...",
  "Executing strategy...",
  "Exploring the Realms...",
  "Searching for alpha...",
  "Calculating optimal path...",
  "Monitoring hex activity...",
  "Processing onchain data...",
];

/** Initial agent definitions. */
export const INITIAL_AGENTS: AgentData[] = [
  {
    id: 0,
    coord: { q: 3, r: 1 },
    targetCoord: { q: 3, r: 1 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[0],
    glyph: "A",
  },
  {
    id: 1,
    coord: { q: -4, r: 2 },
    targetCoord: { q: -4, r: 2 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[1],
    glyph: "A",
  },
  {
    id: 2,
    coord: { q: 1, r: -4 },
    targetCoord: { q: 1, r: -4 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[2],
    glyph: "A",
  },
  {
    id: 3,
    coord: { q: -2, r: 6 },
    targetCoord: { q: -2, r: 6 },
    pixelPos: { x: 0, y: 0 },
    phrase: AGENT_PHRASES[3],
    glyph: "A",
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
  "16 orders. One world. Infinite agents.",
  "The Realms were forged in the fires of on-chain permanence.",
  "Every hex holds a story. Every agent writes a new one.",
  "In the beginning, there was the Loot bag.",
  "The DAO remembers what individuals forget.",
];
