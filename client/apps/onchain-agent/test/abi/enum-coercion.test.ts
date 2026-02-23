import { describe, expect, it } from "vitest";
import { CairoCustomEnum } from "starknet";
import { coerceEnumParams } from "../../src/abi/executor";

// Minimal ABI matching real manifest structure for troop_management_systems
const MINIMAL_ABI = [
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

describe("coerceEnumParams", () => {
  it("converts numeric enum values to CairoCustomEnum", () => {
    const params = {
      for_structure_id: 42,
      category: 0,
      tier: 1,
      amount: 100,
      spawn_direction: 3,
    };

    const result = coerceEnumParams(params, "explorer_create", MINIMAL_ABI);

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

    const result = coerceEnumParams(params, "explorer_create", MINIMAL_ABI);
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

    const result = coerceEnumParams(params, "explorer_create", MINIMAL_ABI);
    expect(result.category).toBeInstanceOf(CairoCustomEnum);
    expect((result.category as CairoCustomEnum).activeVariant()).toBe("Crossbowman");
  });

  it("returns params unchanged for unknown entrypoint", () => {
    const params = { foo: 42 };
    const result = coerceEnumParams(params, "nonexistent", MINIMAL_ABI);
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

    const result = coerceEnumParams(params, "explorer_create", MINIMAL_ABI);
    // Out-of-range should be left as-is (let starknet.js handle the error)
    expect(result.category).toBe(99);
  });
});
