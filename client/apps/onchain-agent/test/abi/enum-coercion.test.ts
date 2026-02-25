import { describe, expect, it } from "vitest";
import { CairoCustomEnum } from "starknet";
import { coerceEnumParams } from "../../src/abi/executor";

// Minimal ABI matching real manifest structure for troop_management_systems
const TROOP_ABI = [
  {
    type: "interface",
    name: "ITroopManagementSystems",
    items: [
      {
        type: "function",
        name: "explorer_create",
        inputs: [
          { name: "for_structure_id", type: "core::integer::u32" },
          { name: "category", type: "s1_eternum::models::troop::TroopType" },
          { name: "tier", type: "s1_eternum::models::troop::TroopTier" },
          { name: "amount", type: "core::integer::u128" },
          { name: "spawn_direction", type: "s1_eternum::models::position::Direction" },
        ],
        outputs: [{ type: "core::integer::u32" }],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "enum",
    name: "s1_eternum::models::troop::TroopType",
    variants: [
      { name: "Knight", type: "()" },
      { name: "Paladin", type: "()" },
      { name: "Crossbowman", type: "()" },
    ],
  },
  {
    type: "enum",
    name: "s1_eternum::models::troop::TroopTier",
    variants: [
      { name: "T1", type: "()" },
      { name: "T2", type: "()" },
      { name: "T3", type: "()" },
    ],
  },
  {
    type: "enum",
    name: "s1_eternum::models::position::Direction",
    variants: [
      { name: "East", type: "()" },
      { name: "NorthEast", type: "()" },
      { name: "NorthWest", type: "()" },
      { name: "West", type: "()" },
      { name: "SouthWest", type: "()" },
      { name: "SouthEast", type: "()" },
    ],
  },
];

// ABI for troop_movement_systems with Span<Direction>
const MOVEMENT_ABI = [
  {
    type: "interface",
    name: "ITroopMovementSystems",
    items: [
      {
        type: "function",
        name: "explorer_move",
        inputs: [
          { name: "explorer_id", type: "core::integer::u32" },
          { name: "directions", type: "core::array::Span::<s1_eternum::models::position::Direction>" },
          { name: "explore", type: "core::bool" },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "enum",
    name: "s1_eternum::models::position::Direction",
    variants: [
      { name: "East", type: "()" },
      { name: "NorthEast", type: "()" },
      { name: "NorthWest", type: "()" },
      { name: "West", type: "()" },
      { name: "SouthWest", type: "()" },
      { name: "SouthEast", type: "()" },
    ],
  },
];

describe("coerceEnumParams", () => {
  it("converts numeric enum values to CairoCustomEnum", () => {
    const params = {
      for_structure_id: 42,
      category: 0,
      tier: 1,
      amount: 100,
      spawn_direction: 3,
    };

    const result = coerceEnumParams(params, "explorer_create", TROOP_ABI);

    expect(result.for_structure_id).toBe(42);
    expect(result.amount).toBe(100);

    expect(result.category).toBeInstanceOf(CairoCustomEnum);
    expect((result.category as CairoCustomEnum).activeVariant()).toBe("Knight");

    expect(result.tier).toBeInstanceOf(CairoCustomEnum);
    expect((result.tier as CairoCustomEnum).activeVariant()).toBe("T2");

    expect(result.spawn_direction).toBeInstanceOf(CairoCustomEnum);
    expect((result.spawn_direction as CairoCustomEnum).activeVariant()).toBe("West");
  });

  it("leaves existing CairoCustomEnum values unchanged", () => {
    const existing = new CairoCustomEnum({
      Knight: {},
      Paladin: undefined,
      Crossbowman: undefined,
    });

    const params = {
      for_structure_id: 42,
      category: existing,
      tier: 0,
      amount: 100,
      spawn_direction: 0,
    };

    const result = coerceEnumParams(params, "explorer_create", TROOP_ABI);
    expect(result.category).toBe(existing);
  });

  it("handles string numeric values", () => {
    const params = {
      for_structure_id: 42,
      category: "2",
      tier: 0,
      amount: 100,
      spawn_direction: 0,
    };

    const result = coerceEnumParams(params, "explorer_create", TROOP_ABI);
    expect(result.category).toBeInstanceOf(CairoCustomEnum);
    expect((result.category as CairoCustomEnum).activeVariant()).toBe("Crossbowman");
  });

  it("returns params unchanged for unknown entrypoint", () => {
    const params = { foo: 42 };
    const result = coerceEnumParams(params, "nonexistent", TROOP_ABI);
    expect(result).toEqual(params);
  });

  it("handles out-of-range index gracefully", () => {
    const params = {
      for_structure_id: 42,
      category: 99,
      tier: 0,
      amount: 100,
      spawn_direction: 0,
    };

    const result = coerceEnumParams(params, "explorer_create", TROOP_ABI);
    expect(result.category).toBe(99);
  });

  // ── camelCase key normalization ─────────────────────────────────────────────

  it("normalizes camelCase param keys to snake_case ABI names", () => {
    // This is exactly what the LLM sends in production
    const params = {
      forStructureId: 572,
      category: 1,
      tier: 0,
      amount: 700,
      spawnDirection: 0,
    };

    const result = coerceEnumParams(params, "explorer_create", TROOP_ABI);

    // Keys should be normalized to snake_case
    expect(result.for_structure_id).toBe(572);
    expect(result.amount).toBe(700);

    // Enum params should be coerced
    expect(result.category).toBeInstanceOf(CairoCustomEnum);
    expect((result.category as CairoCustomEnum).activeVariant()).toBe("Paladin");

    expect(result.tier).toBeInstanceOf(CairoCustomEnum);
    expect((result.tier as CairoCustomEnum).activeVariant()).toBe("T1");

    expect(result.spawn_direction).toBeInstanceOf(CairoCustomEnum);
    expect((result.spawn_direction as CairoCustomEnum).activeVariant()).toBe("East");

    // camelCase keys should not remain
    expect(result.forStructureId).toBeUndefined();
    expect(result.spawnDirection).toBeUndefined();
  });

  // ── Span<enum> coercion ─────────────────────────────────────────────────────

  it("coerces arrays of numeric enums for Span<Direction> params", () => {
    const params = {
      explorer_id: 42,
      directions: [0, 1, 3], // East, NorthEast, West
      explore: true,
    };

    const result = coerceEnumParams(params, "explorer_move", MOVEMENT_ABI);

    expect(result.explorer_id).toBe(42);
    expect(result.explore).toBe(true);

    const dirs = result.directions as CairoCustomEnum[];
    expect(Array.isArray(dirs)).toBe(true);
    expect(dirs.length).toBe(3);
    expect(dirs[0]).toBeInstanceOf(CairoCustomEnum);
    expect(dirs[0].activeVariant()).toBe("East");
    expect(dirs[1].activeVariant()).toBe("NorthEast");
    expect(dirs[2].activeVariant()).toBe("West");
  });

  it("leaves already-coerced Span<enum> arrays unchanged", () => {
    const east = new CairoCustomEnum({
      East: {},
      NorthEast: undefined,
      NorthWest: undefined,
      West: undefined,
      SouthWest: undefined,
      SouthEast: undefined,
    });

    const params = {
      explorer_id: 42,
      directions: [east],
      explore: false,
    };

    const result = coerceEnumParams(params, "explorer_move", MOVEMENT_ABI);
    const dirs = result.directions as CairoCustomEnum[];
    expect(dirs[0]).toBe(east); // Same reference
  });

  it("normalizes a single Span<enum> scalar into a one-item array", () => {
    const params = {
      explorer_id: 42,
      directions: 2, // NorthWest
      explore: false,
    };

    const result = coerceEnumParams(params, "explorer_move", MOVEMENT_ABI);
    const dirs = result.directions as CairoCustomEnum[];
    expect(Array.isArray(dirs)).toBe(true);
    expect(dirs).toHaveLength(1);
    expect(dirs[0]).toBeInstanceOf(CairoCustomEnum);
    expect(dirs[0].activeVariant()).toBe("NorthWest");
  });

  it("normalizes numeric-key objects for Span<enum> params", () => {
    const params = {
      explorer_id: 42,
      directions: { 0: 1, 1: 3 }, // NorthEast, West
      explore: false,
    };

    const result = coerceEnumParams(params, "explorer_move", MOVEMENT_ABI);
    const dirs = result.directions as CairoCustomEnum[];
    expect(Array.isArray(dirs)).toBe(true);
    expect(dirs).toHaveLength(2);
    expect(dirs[0].activeVariant()).toBe("NorthEast");
    expect(dirs[1].activeVariant()).toBe("West");
  });
});
