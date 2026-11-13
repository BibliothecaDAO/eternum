// @vitest-environment node
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEAT_COLOURS, seatSide } from "@/tokens";
import { overrideSpectateIntent } from "./spectator-session";
import { isEntityOwnedByAccount, seatOrder, watchedSide } from "./entity-ownership";

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

describe("seats (side-colours-4: a watching viewer sees each player in their seat's colour)", () => {
  afterEach(() => overrideSpectateIntent(false));
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

  it("tells nothing by seat while the viewer plays", () => {
    const { store } = game({ structures: [[2n, 0xbn]], players: [0xbn] });
    expect(watchedSide(store, 0xbn)).toBeNull();
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
