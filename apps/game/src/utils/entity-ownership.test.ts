// @vitest-environment node
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";
import { arePlayersAllied, isEntityOwnedByAccount } from "./entity-ownership";

const fixture = () => {
  configManager.setActiveGame(1, 1);
  const store = new NativeFactStore();
  const write = (model: string, keys: (number | bigint)[], row: Record<string, unknown>) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [{ hashed_keys: hash.computePoseidonHashOnElements(keys), models: { [model]: row } }],
      },
    ]);
  write("Structure", [1, 1], {
    game_id: 1,
    entity_id: 1,
    owner: "0xabc",
    resources_packed: "0",
    troop_explorers: [],
    base: {
      category: 1,
      level: 0,
      created_at: 0,
      coord_x: 0,
      coord_y: 0,
      alt: false,
      troop_explorer_count: 0,
      troop_max_guard_count: 1,
      troop_max_explorer_count: 1,
      starting_troops_granted: false,
    },
    metadata: { realm_id: 1, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, attunement: 0 },
  });
  return { store, write };
};
describe("native ownership", () => {
  it("compares padded and unpadded addresses numerically", () => {
    const { store } = fixture();
    expect(isEntityOwnedByAccount(store, 1, "  0xABC ")).toBe(true);
    expect(isEntityOwnedByAccount(store, 1, "0x000abc")).toBe(true);
    expect(isEntityOwnedByAccount(store, 1, "0xdef")).toBe(false);
  });
  it("rejects missing rows, invalid IDs and missing accounts", () => {
    const { store } = fixture();
    for (const id of [0, 1.5, NaN, 2]) expect(isEntityOwnedByAccount(store, id, "0xabc")).toBe(false);
    expect(isEntityOwnedByAccount(store, 1, undefined)).toBe(false);
    expect(isEntityOwnedByAccount(store, 1, "invalid")).toBe(false);
    expect(isEntityOwnedByAccount(null, 1, "0xabc")).toBe(false);
  });
  it("does not reuse ownership from another game", () => {
    const { store } = fixture();
    configManager.setActiveGame(2, 1);
    expect(isEntityOwnedByAccount(store, 1, "0xabc")).toBe(false);
  });
  it("follows membership changes and deletion without an army update", () => {
    const { store, write } = fixture();
    const member = (actor: number, guild: number) =>
      write("GuildMember", [1, actor], { game_id: 1, actor, guild_id: guild });
    member(1, 99);
    member(2, 99);
    expect(arePlayersAllied(store, "0x01", 2n)).toBe(true);
    member(2, 88);
    expect(arePlayersAllied(store, 1n, 2n)).toBe(false);
    member(2, 99);
    store.applyEntityOperations([
      { type: "remove-components", entityId: hash.computePoseidonHashOnElements([1, 2]), models: ["GuildMember"] },
    ]);
    expect(arePlayersAllied(store, 1n, 2n)).toBe(false);
    expect(arePlayersAllied(store, 1n, 1n)).toBe(false);
    expect(arePlayersAllied(store, undefined, 2n)).toBe(false);
  });
});
