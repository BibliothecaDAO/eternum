import type { Model } from "@mariozechner/pi-ai";

/**
 * Generic world state representation for any game.
 * TEntity is game-specific (units, buildings, cards, pieces, etc.)
 */
export interface WorldState<TEntity = unknown> {
  tick: number;
  timestamp: number;
  entities: TEntity[];
  resources?: Map<string, number>;
  raw?: unknown;
}

/**
 * Adapter pattern for connecting to any game.
 * Implement this per-game (Dojo, EVM, etc.)
 */
export interface GameAdapter<TState extends WorldState = WorldState> {
  getWorldState(): Promise<TState>;
  executeAction(action: GameAction): Promise<ActionResult>;
  simulateAction(action: GameAction): Promise<SimulationResult>;
  subscribe?(callback: (state: TState) => void): () => void;
}

/**
 * An action the agent can take in the game.
 */
export interface GameAction {
  type: string;
  params: Record<string, unknown>;
}

/**
 * Describes a single parameter for an action definition.
 */
export interface ActionParamSchema {
  name: string;
  type: "number" | "string" | "boolean" | "number[]" | "object[]" | "object" | "bigint";
  description: string;
  required?: boolean;
}

/**
 * Declarative definition of a game action — its type, description, and expected parameters.
 * Used to generate rich tool descriptions so the LLM knows exactly what params each action needs.
 */
export interface ActionDefinition {
  type: string;
  description: string;
  params: ActionParamSchema[];
}

/**
 * Result of executing an action on chain.
 */
export interface ActionResult {
  success: boolean;
  txHash?: string;
  data?: unknown;
  error?: string;
}

/**
 * Result of simulating an action (dry run).
 */
export interface SimulationResult {
  success: boolean;
  outcome?: unknown;
  cost?: unknown;
  error?: string;
}

/**
 * Configuration for creating a game agent.
 */
export interface GameAgentConfig<TState extends WorldState = WorldState> {
  adapter: GameAdapter<TState>;
  dataDir: string;
  model?: Model<any>;
  tickIntervalMs?: number;
  /** Custom tick prompt formatter. Receives full state, returns prompt string for the agent. */
  formatTickPrompt?: (state: TState) => string;
}

export interface RuntimeConfigChange {
  path: string;
  value: unknown;
}

export interface RuntimeConfigUpdateResult {
  path: string;
  applied: boolean;
  message: string;
}

export interface RuntimeConfigApplyResult {
  ok: boolean;
  results: RuntimeConfigUpdateResult[];
  currentConfig: Record<string, unknown>;
}

export interface RuntimeConfigManager {
  getConfig(): Record<string, unknown>;
  applyChanges(changes: RuntimeConfigChange[], reason?: string): Promise<RuntimeConfigApplyResult>;
}
