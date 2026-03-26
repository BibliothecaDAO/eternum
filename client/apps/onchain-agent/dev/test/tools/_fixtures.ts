/**
 * Shared mock factory for combat tool tests.
 *
 * Creates a minimal ToolContext with vi.fn() stubs for all provider methods
 * used by attack, transfer, and guard tools.
 */

import { vi } from "vitest";
import type { ToolContext } from "../../../src/tools/core/context";

/** Default explorer position — even row for predictable adjacency. */
export const DEFAULT_EXPLORER_POS = { x: 10, y: 10 };

/**
 * Adjacent position EAST of the default explorer (even-row offset grid).
 * For even rows, EAST neighbor of (col, row) is (col+1, row).
 */
export const ADJACENT_EAST_POS = { x: 11, y: 10 };

/** A position that is NOT adjacent to DEFAULT_EXPLORER_POS. */
export const NON_ADJACENT_POS = { x: 20, y: 20 };

/** Default player address used in all mocks. */
export const PLAYER_ADDRESS = "0x1";

/** A different address representing an enemy player. */
export const ENEMY_ADDRESS = "0x2";

/** Default explorer entity returned by explorerInfo. */
export function defaultExplorer(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 1,
    ownerName: "Player",
    ownerAddress: PLAYER_ADDRESS,
    troopType: "Knight",
    troopTier: "T1",
    troopCount: 1000,
    stamina: 100,
    staminaUpdatedTick: 0,
    position: DEFAULT_EXPLORER_POS,
    ...overrides,
  };
}

/**
 * Create a minimal ToolContext with vi.fn() stubs.
 *
 * All provider and client methods default to no-op / null returns.
 * Override via the returned object after creation.
 */
export function createMockToolContext(): ToolContext {
  return {
    client: {
      view: {
        explorerInfo: vi.fn(async () => null),
        structureAt: vi.fn(async () => null),
      },
    },
    provider: {
      // Combat
      attack_explorer_vs_explorer: vi.fn(async () => {}),
      attack_explorer_vs_guard: vi.fn(async () => {}),
      // Resource transfer
      send_resources: vi.fn(async () => {}),
      pickup_resources: vi.fn(async () => {}),
      // Troop transfer
      troop_structure_adjacent_transfer: vi.fn(async () => {}),
      troop_troop_adjacent_transfer: vi.fn(async () => {}),
      // Explorer swap
      explorer_explorer_swap: vi.fn(async () => {}),
      // Guard operations
      explorer_guard_swap: vi.fn(async () => {}),
      guard_add: vi.fn(async () => {}),
      guard_explorer_swap: vi.fn(async () => {}),
    },
    signer: {} as any,
    playerAddress: PLAYER_ADDRESS,
    gameConfig: {
      stamina: {
        armiesTickInSeconds: 1,
        gainPerTick: 20,
        knightMaxStamina: 120,
        paladinMaxStamina: 140,
        crossbowmanMaxStamina: 120,
      },
    },
    snapshot: {
      tiles: [],
      gridIndex: new Map(),
      rowCount: 0,
      colCount: 0,
    },
    mapCenter: 0,
  } as unknown as ToolContext;
}
