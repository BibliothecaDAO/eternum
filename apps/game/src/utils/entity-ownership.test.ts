// @vitest-environment node
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HUD_SHEET, SEAT_COLOURS, seatSide } from "@/tokens";
import { overrideSpectateIntent } from "./spectator-session";
import {
  arePlayersAllied,
  isEntityOwnedByAccount,
  onSidesChanged,
  seatOrder,
  setOpenGameSeats,
  watchedSide,
} from "./entity-ownership";

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

describe("seats (side-colours-4: a watching viewer sees each player in their seat's colour)", () => {
  afterEach(() => {
    overrideSpectateIntent(false);
    setOpenGameSeats(0, []);
  });
  /** A game whose structures are `[entity id, owner]`, with the given registered players and Blitz roster. */
  const game = ({
    structures = [],
    players = [],
    roster,
  }: {
    structures?: [bigint, bigint][];
    players?: bigint[];
    roster?: bigint[];
  }) => {
    const { store, write } = fixture();
    // The fixture's own structure 1 (owner 0xabc) is replaced by the game's.
    write("Structure", [1, 1], { ...structureRow(1n, 0n) });
    for (const [entity, owner] of structures) write("Structure", [1, entity], structureRow(entity, owner));
    for (const player of players) write("PlayerEntry", [1, player], { game_id: 1, owner: player, player });
    if (roster)
      write("BlitzRoster", [1], {
        game_id: 1,
        players: roster.map((account) => ({ account, wallet: account + 1000n })),
      });
    return { store, write };
  };

  it("seats a Blitz game in its roster's order, whatever its realms' ids", () => {
    const { store } = game({
      structures: [
        [1n, 0xbn],
        [2n, 0xan],
      ],
      roster: [0xbn, 0xcn, 0xan],
    });
    expect(seatOrder(store)).toEqual([0xbn, 0xcn, 0xan]);
  });

  it("seats an open game by its players as Herald lists them, and says so when they change", () => {
    const { store } = game({ structures: [[2n, 0xbn]], players: [0xbn] });
    expect(seatOrder(store)).toEqual([]);
    const heard = vi.fn();
    const stop = onSidesChanged(heard);
    setOpenGameSeats(1, [0xbn, 0xan]);
    expect(seatOrder(store)).toEqual([0xbn, 0xan]);
    setOpenGameSeats(1, [0xbn, 0xan]);
    expect(heard).toHaveBeenCalledTimes(1);
    // Another game's list is not this one's; a roster, on the chain, wins over any.
    setOpenGameSeats(2, [0xcn]);
    expect(seatOrder(store)).toEqual([]);
    stop();
    setOpenGameSeats(1, [0xan]);
    expect(heard).toHaveBeenCalledTimes(2);
    const blitz = game({ roster: [0xcn] });
    expect(seatOrder(blitz.store)).toEqual([0xcn]);
  });

  it("tells nothing by seat while the viewer plays", () => {
    const { store } = game({ structures: [[2n, 0xbn]], players: [0xbn] });
    expect(watchedSide(store, 0xbn)).toBeNull();
  });

  it("gives a watching viewer each player's seat colour and nobody's grey", () => {
    const { store } = game({
      structures: [
        [2n, 0xbn],
        [5n, 0xan],
      ],
      players: [0xan, 0xbn],
    });
    setOpenGameSeats(1, [0xbn, 0xan]);
    overrideSpectateIntent(true);
    expect(watchedSide(store, "0x0b")).toEqual({ seat: 0, colour: SEAT_COLOURS[0], ink: "dark" });
    expect(watchedSide(store, 0xan)).toMatchObject({ seat: 1, colour: SEAT_COLOURS[1] });
    expect(watchedSide(store, 0n)).toEqual({ seat: null, colour: HUD_SHEET.neutral });
    expect(watchedSide(store, 0xeeen)).toEqual({ seat: null, colour: HUD_SHEET.neutral });
  });

  it("starts the 24 colours again past the 24th seat, and writes each initial in the ink its colour reads in", () => {
    expect(seatSide(24)).toEqual({ ...seatSide(0), seat: 24 });
    expect(seatSide(25).colour).toBe(SEAT_COLOURS[1]);
    expect(SEAT_COLOURS.map((_, seat) => (seatSide(seat) as { ink: string }).ink)).toContain("light");
    expect(new Set(SEAT_COLOURS).size).toBe(24);
  });
});

/** A level-0 realm `entity` held by `owner`, as the chain writes it. */
const structureRow = (entity: bigint, owner: bigint) => ({
  game_id: 1,
  entity_id: entity,
  owner,
  resources_packed: "0",
  base: {
    category: 1,
    level: 0,
    created_at: 0,
    troop_max_guard_count: 1,
    troop_max_explorer_count: 1,
    starting_troops_granted: false,
  },
  metadata: { realm_id: 1, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, deepest_depth: 0 },
});
