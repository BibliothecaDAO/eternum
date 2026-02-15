import type { AgentData, EnemyData, FeatureHexData, HexCoord, PixelCoord } from "./types";
import { hexToPixel, hexKey, hexesInRange } from "./hex-utils";
import { FEATURE_HEXES, INITIAL_AGENTS, INITIAL_ENEMIES } from "./feature-data";

/** Tiny fill characters for empty hexes. */
const FILL_CHARS = [".", ":", "\u00b7", "+", ".", ":", "\u00b7"];

/** Pick a random element from an array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GameState {
  // Grid
  hexSize: number;
  gridRadius: number;
  hexFills: Map<string, string>;

  // Player
  playerHex: HexCoord;
  playerTargetHex: HexCoord;
  playerPixel: PixelCoord;
  playerTargetPixel: PixelCoord;
  isMoving: boolean;
  moveStartTime: number;
  trail: HexCoord[];

  // Camera
  cameraX: number;
  cameraY: number;

  // Agents
  agents: AgentData[];
  agentMoveTimers: number[];

  // Enemies
  enemies: EnemyData[];
  lastEnemyMoveTime: number;
  deathFlashTime: number;
  isDead: boolean;

  // Feature/agent proximity
  activeFeature: FeatureHexData | null;
  activeAgent: AgentData | null;

  // Misc
  time: number;
  initialized: boolean;
  prefersReducedMotion: boolean;
  hasReceivedInput: boolean;

  // O(1) feature lookup
  featureMap: Map<string, FeatureHexData>;
}

/** Create a fresh game state with all entities at starting positions. */
export function createInitialState(): GameState {
  return {
    hexSize: 44,
    gridRadius: 30,
    hexFills: new Map(),
    playerHex: { q: 0, r: 0 },
    playerTargetHex: { q: 0, r: 0 },
    playerPixel: { x: 0, y: 0 },
    playerTargetPixel: { x: 0, y: 0 },
    isMoving: false,
    moveStartTime: 0,
    trail: [],
    cameraX: 0,
    cameraY: 0,
    agents: INITIAL_AGENTS.map((a) => ({ ...a })),
    agentMoveTimers: INITIAL_AGENTS.map(() => 0),
    enemies: INITIAL_ENEMIES.map((e) => ({ ...e })),
    lastEnemyMoveTime: 0,
    deathFlashTime: 0,
    isDead: false,
    activeFeature: null,
    activeAgent: null,
    time: 0,
    initialized: false,
    prefersReducedMotion: false,
    hasReceivedInput: false,
    featureMap: new Map(),
  };
}

/** One-time initialization: build feature map, hex fills, pixel positions. */
export function initializeState(state: GameState): void {
  if (state.initialized) return;
  state.initialized = true;

  state.prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Build feature map
  for (const f of FEATURE_HEXES) {
    state.featureMap.set(hexKey(f.coord), f);
  }

  // Generate random fill chars
  const allHexes = hexesInRange({ q: 0, r: 0 }, state.gridRadius);
  for (const h of allHexes) {
    state.hexFills.set(hexKey(h), pick(FILL_CHARS));
  }

  // Initialize pixel positions
  state.playerPixel = hexToPixel(state.playerHex, state.hexSize);
  state.playerTargetPixel = { ...state.playerPixel };
  state.cameraX = state.playerPixel.x;
  state.cameraY = state.playerPixel.y;

  for (const agent of state.agents) {
    agent.pixelPos = hexToPixel(agent.coord, state.hexSize);
  }

  for (const enemy of state.enemies) {
    enemy.pixelPos = hexToPixel(enemy.coord, state.hexSize);
  }
}

/** Reset player and enemies after death. */
export function resetAfterDeath(state: GameState): void {
  state.isDead = false;
  state.deathFlashTime = 0;
  state.playerHex = { q: 0, r: 0 };
  state.playerTargetHex = { q: 0, r: 0 };
  state.playerPixel = hexToPixel(state.playerHex, state.hexSize);
  state.playerTargetPixel = { ...state.playerPixel };
  state.isMoving = false;
  state.trail = [];

  for (let i = 0; i < state.enemies.length; i++) {
    const start = INITIAL_ENEMIES[i];
    state.enemies[i].coord = { ...start.startCoord };
    state.enemies[i].targetCoord = { ...start.startCoord };
    state.enemies[i].pixelPos = hexToPixel(start.startCoord, state.hexSize);
  }

  state.activeFeature = null;
  state.activeAgent = null;
}
