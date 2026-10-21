// @vitest-environment node
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { arePlayersAllied, isEntityOwnedByAccount } from "./entity-ownership";

const fixture = () => {
  configManager.setActiveGame(1, 1);
  const store = new NativeFactStore();
  const write = (model: string, keys: (number | bigint)[], row: Record<string, unknown>) =>
    store.applyFacts([{ model: model, key: hash.computePoseidonHashOnElements(keys), value: row }]);
  write("Structure", [1, 1], {
    game_id: 1,
    entity_id: 1,
    owner: "0xabc",
    resources_packed: "0",
    base: {
      category: 1,
      level: 0,
      created_at: 0,
      troop_max_guard_count: 1,
      troop_max_explorer_count: 1,
      starting_troops_granted: false,
    },
    metadata: {
      realm_id: 1,
      order: 0,
      has_wonder: false,
      village_realm: 0,
      mine_kind: 0,
      deepest_depth: 0,
    },
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
});

/** The registered presets of each mode (native-preset-modes.ts): the game's mode is its preset's. */
const PRESETS = { eternum: 3, blitz: 2, duel: 4, frontier: 5 } as const;

describe("allies (owner, 2026-10-21: tribe members, in Eternum only)", () => {
  afterEach(() => vi.restoreAllMocks());
  /** A game of the given mode where players 1 and 2 hold the given tribe memberships (none where undefined). */
  const game = (preset: number, guilds: { 1?: number; 2?: number }) => {
    const { store, write } = fixture();
    // The game's registry row names its preset; the real preset table (native-preset-modes.ts) gives its mode.
    vi.spyOn(configManager, "getPresetId").mockReturnValue(preset);
    const member = (actor: 1 | 2, guild: number) =>
      write("GuildMember", [1, actor], { game_id: 1, actor, guild_id: guild });
    if (guilds[1] !== undefined) member(1, guilds[1]);
    if (guilds[2] !== undefined) member(2, guilds[2]);
    return { store, member };
  };

  it("makes members of one tribe allies in Eternum, and no one else", () => {
    expect(arePlayersAllied(game(PRESETS.eternum, { 1: 99, 2: 99 }).store, "0x01", 2n)).toBe(true);
    expect(arePlayersAllied(game(PRESETS.eternum, { 1: 99, 2: 88 }).store, 1n, 2n)).toBe(false);
    expect(arePlayersAllied(game(PRESETS.eternum, { 1: 99 }).store, 1n, 2n)).toBe(false);
    expect(arePlayersAllied(game(PRESETS.eternum, {}).store, 1n, 2n)).toBe(false);
    const { store } = game(PRESETS.eternum, { 1: 99, 2: 99 });
    expect(arePlayersAllied(store, 1n, 1n)).toBe(false);
    expect(arePlayersAllied(store, undefined, 2n)).toBe(false);
  });

  it("follows membership changes and deletion in Eternum without an army update", () => {
    const { store, member } = game(PRESETS.eternum, { 1: 99, 2: 99 });
    expect(arePlayersAllied(store, 1n, 2n)).toBe(true);
    member(2, 88);
    expect(arePlayersAllied(store, 1n, 2n)).toBe(false);
    member(2, 99);
    expect(arePlayersAllied(store, 1n, 2n)).toBe(true);
    store.applyFacts([{ model: "GuildMember", key: hash.computePoseidonHashOnElements([1, 2]), value: null }]);
    expect(arePlayersAllied(store, 1n, 2n)).toBe(false);
  });

  it("makes no allies in Blitz, Duel or Frontier, though the chain lets a tribe form there", () => {
    for (const preset of [PRESETS.blitz, PRESETS.duel, PRESETS.frontier]) {
      expect(arePlayersAllied(game(preset, { 1: 99, 2: 99 }).store, 1n, 2n)).toBe(false);
      expect(arePlayersAllied(game(preset, { 1: 99, 2: 88 }).store, 1n, 2n)).toBe(false);
      expect(arePlayersAllied(game(preset, { 1: 99 }).store, 1n, 2n)).toBe(false);
      const { store } = game(preset, { 1: 99, 2: 99 });
      store.applyFacts([{ model: "GuildMember", key: hash.computePoseidonHashOnElements([1, 2]), value: null }]);
      expect(arePlayersAllied(store, 1n, 2n)).toBe(false);
    }
  });
});
