/**
 * Shared context passed to all core tool functions.
 *
 * Framework-agnostic — both the MCP server and PI agent tools
 * construct this from their respective environments.
 */

import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import type { GameConfig } from "@bibliothecadao/torii";
import type { AccountInterface } from "starknet";
import type { MapSnapshot } from "../../map/renderer.js";

/**
 * Everything a core tool function needs to query state and execute transactions.
 *
 * Constructed once at startup and passed to each tool call. The MCP server
 * builds this from its bootstrap state; the PI agent builds it from its
 * tick context.
 */
export interface ToolContext {
  /** Eternum SDK client for querying on-chain state via Torii SQL. */
  client: EternumClient;
  /** Eternum provider for submitting on-chain transactions. */
  provider: EternumProvider;
  /** Authenticated account signer. */
  signer: AccountInterface;
  /** Hex address of the player. */
  playerAddress: string;
  /** On-chain game configuration (building costs, recipes, stamina). */
  gameConfig: GameConfig;
  /** Current map snapshot with tile data and grid index. */
  snapshot: MapSnapshot;
  /**
   * Map center for coordinate conversion.
   * Display coords = raw - mapCenter (X), -(raw - mapCenter) (Y).
   * 0 = no conversion.
   */
  mapCenter: number;

  /**
   * Maximum cargo weight a single donkey can carry, in grams.
   * Defaults to 50,000g (50kg) per WorldConfig. Used by `sendResources`
   * to compute donkey cost before dispatching a caravan.
   */
  donkeyCapacityGrams?: number;

  /**
   * Per-unit weight in grams for each resource type, keyed by resource ID.
   * Loaded from on-chain WeightConfig during bootstrap. Used by
   * `sendResources` to compute total cargo weight and donkey cost.
   */
  resourceWeightGrams?: Map<number, number>;
}

/** Convert raw contract X coordinate to display coordinate. */
export function toDisplayX(raw: number, mapCenter: number): number {
  return mapCenter ? raw - mapCenter : raw;
}

/** Convert raw contract Y coordinate to display coordinate (negated: positive = north). */
export function toDisplayY(raw: number, mapCenter: number): number {
  return mapCenter ? -(raw - mapCenter) : raw;
}

/** Convert display X coordinate to raw contract coordinate. */
export function toContractX(display: number, mapCenter: number): number {
  return mapCenter ? display + mapCenter : display;
}

/** Convert display Y coordinate to raw contract coordinate (negated back). */
export function toContractY(display: number, mapCenter: number): number {
  return mapCenter ? -display + mapCenter : display;
}

/** Format a raw position as a display string like "(6,4)". */
export function fmtPos(rawX: number, rawY: number, mapCenter: number): string {
  return `(${toDisplayX(rawX, mapCenter)},${toDisplayY(rawY, mapCenter)})`;
}
