import type { NativeRows } from "../../../contracts/l3/world-native/schema/client.gen";

export function depositStructure(owner: string, category = 1): NativeRows["Structure"] {
  return {
    game_id: 7,
    entity_id: 17n,
    owner: BigInt(owner),
    base: {
      category,
      level: 1,
      created_at: 1,
      troop_max_guard_count: 1,
      troop_max_explorer_count: 5,
      starting_troops_granted: true,
    },
    resources_packed: 0n,
    metadata: { realm_id: 0, order: 0, has_wonder: false, village_realm: 0n, mine_kind: 0, deepest_depth: 0 },
  };
}

/** Herald preserves struct nesting and represents felt integers as hex strings in JSON. */
export function structureSnapshot(owner: string, category = 1): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(depositStructure(owner, category), (_key, value) =>
      typeof value === "number" || typeof value === "bigint" ? `0x${value.toString(16)}` : value,
    ),
  );
}
