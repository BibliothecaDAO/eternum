import { describe, expect, it } from "vitest";
import rowFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { GameSyncFact } from "../sync/game-sync-types";
import { NativeFactStore } from "./native-fact-store";

const explorer = { ...rowFixture.expected.key, ...rowFixture.expected.value };
const set = (key: string, model: string, value: Record<string, unknown>): GameSyncFact => ({ model, key, value });
const remove = (key: string, model: string): GameSyncFact => ({ model, key, value: null });
const balance = (entity: number, amount: string, game = 1) => ({
  game_id: game,
  entity_id: entity,
  resource_type: 1,
  balance: amount,
});
const structure = (owner: string, game = 1) => ({
  game_id: game,
  entity_id: 7,
  owner,
  base: {
    category: 1,
    level: 0,
    created_at: "0x1",
    coord_x: 12,
    coord_y: 34,
    alt: false,
    troop_explorer_count: 0,
    troop_max_guard_count: 0,
    troop_max_explorer_count: 0,
    starting_troops_granted: false,
  },
  troop_explorers: [],
  resources_packed: "0x0",
  metadata: {
    realm_id: 1,
    village_realm: 0,
    mine_kind: 0,
    attunement: 0,
    barracks_tier: 0,
    has_wonder: false,
    order: 0,
  },
});

describe("native fact store", () => {
  it("indexes native keys by game and rejects reserved games", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x1", "VillageRaid", { game_id: 2, entity_id: 4, last_tick: "300" })]);
    expect(store.get("VillageRaid", { game_id: 2, entity_id: 4 })?.last_tick).toBe(300n);
    expect([...store.inGame("VillageRaid", 2)]).toHaveLength(1);
    expect([...store.inGame("VillageRaid", 1)]).toHaveLength(0);
    expect(() => store.applyFacts([set("0x2", "VillageRaid", { game_id: 0, entity_id: 4, last_tick: "300" })])).toThrow(
      "Reserved game id",
    );
    store.applyFacts([remove("0x1", "VillageRaid")]);
    expect([...store.inGame("VillageRaid", 2)]).toHaveLength(0);
  });

  it("reads the generated explorer fixture as immutable typed facts", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x7", "ExplorerTroops", explorer)]);
    const row = store.get("ExplorerTroops", { game_id: 1, explorer_id: 7 })!;
    expect(row.troops.category).toBe("Knight");
    expect(row.troops.count).toBe(0n);
    expect(row.coord).toEqual({ alt: false, x: 12, y: 34 });
    expect(Object.isFrozen(row)).toBe(true);
    expect(Object.isFrozen(row.troops)).toBe(true);
  });

  it("publishes one atomic transaction across models and maintains native-key indexes", () => {
    const store = new NativeFactStore();
    const seen: number[] = [];
    store.subscribe((changes) => {
      seen.push(changes.length);
      expect(store.get("ExplorerTroops", { game_id: 1, explorer_id: 7 })).toBeDefined();
      expect(store.get("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: 1 })?.balance).toBe(
        9007199254740993n,
      );
    });
    store.applyFacts([
      set("0x7", "ExplorerTroops", explorer),
      set("0x8", "ResourceBalance", balance(7, "9007199254740993")),
    ]);
    expect(seen).toEqual([2]);
    expect([...store.inGame("ResourceBalance", 1)]).toHaveLength(1);
    expect([...store.inGame("ResourceBalance", 2)]).toEqual([]);
    expect([...store.rows("ResourceBalance")]).toHaveLength(1);
  });

  it("rejects an entire transaction before changing rows or notifying readers", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x8", "ResourceBalance", balance(7, "12"))]);
    let notified = false;
    store.subscribe(() => {
      notified = true;
    });
    expect(() =>
      store.applyFacts([
        set("0x8", "ResourceBalance", balance(7, "100")),
        set("0x7", "ExplorerTroops", { ...explorer, troops: { ...explorer.troops, category: "Unknown" } }),
      ]),
    ).toThrow("Invalid enum");
    expect(store.get("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: 1 })?.balance).toBe(12n);
    expect([...store.rows("ExplorerTroops")]).toEqual([]);
    expect(notified).toBe(false);
  });

  it("coalesces updates and removals while preserving the previous committed row", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x8", "ResourceBalance", balance(7, "12"))]);
    const changes: unknown[] = [];
    store.subscribe((batch) => changes.push(...batch));
    store.applyFacts([
      set("0x8", "ResourceBalance", balance(7, "100")),
      remove("0x08", "ResourceBalance"),
      set("0x8", "ResourceBalance", balance(7, "200")),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ previous: { balance: 12n }, current: { balance: 200n } });
    store.applyFacts([remove("0x8", "ResourceBalance")]);
    expect([...store.rows("ResourceBalance")]).toEqual([]);
    expect([...store.inGame("ResourceBalance", 1)]).toEqual([]);
  });

  it("deleting one model retains other models at the same wire id", () => {
    const store = new NativeFactStore();
    store.applyFacts([
      set("0x7", "ExplorerTroops", explorer),
      set("0x7", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: "0", weight: "0" }),
    ]);
    store.applyFacts([remove("0x7", "ExplorerTroops")]);
    expect([...store.rows("ExplorerTroops")]).toEqual([]);
    expect([...store.rows("ResourceWeight")]).toHaveLength(1);
  });

  it("replaces the retained models in one write and leaves every other model alone", () => {
    const store = new NativeFactStore();
    store.applyFacts([
      set("0x8", "ResourceBalance", balance(7, "1")),
      set("0x9", "ResourceBalance", balance(8, "2")),
      set("0x7", "ExplorerTroops", explorer),
    ]);
    const writes: number[] = [];
    store.subscribe((changes) => writes.push(changes.length));
    store.applyFacts(
      [set("0x9", "ResourceBalance", balance(8, "3"))],
      new Map([["ResourceBalance", new Set(["0x9"])]]),
    );
    expect(writes).toEqual([2]);
    expect([...store.rows("ResourceBalance")].map((row) => row.balance)).toEqual([3n]);
    expect([...store.rows("ExplorerTroops")]).toHaveLength(1);
  });

  it("treats a redelivered row as no change", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x7", "ExplorerTroops", explorer)]);
    let calls = 0;
    store.subscribe(() => calls++);
    store.applyFacts([set("0x7", "ExplorerTroops", { ...explorer })]);
    expect(calls).toBe(0);
  });

  it("rejects malformed numbers, keys, missing fields and unknown models", () => {
    const store = new NativeFactStore();
    for (const value of [-1, Number.MAX_SAFE_INTEGER + 1, "-1", "", true, (1n << 128n).toString()])
      expect(() => store.applyFacts([set("0x8", "ResourceBalance", { ...balance(7, "1"), balance: value })])).toThrow();
    expect(() => store.applyFacts([set("0x8", "ResourceBalance", { game_id: 1 })])).toThrow();
    expect(() => store.applyFacts([set("0x8", "ResourceBalance", { ...balance(7, "1"), extra: 1 })])).toThrow();
    expect(() => store.applyFacts([set("0x8", "Missing", balance(7, "1"))])).toThrow("Unknown native fact");
    expect([...store.rows("ResourceBalance")]).toEqual([]);
  });

  it("detects conflicting wire identities and keeps games separate", () => {
    const store = new NativeFactStore();
    store.applyFacts([
      set("0x8", "ResourceBalance", balance(7, "1", 1)),
      set("0x9", "ResourceBalance", balance(7, "2", 2)),
    ]);
    expect([...store.inGame("ResourceBalance", 1)][0].balance).toBe(1n);
    expect([...store.inGame("ResourceBalance", 2)][0].balance).toBe(2n);
    expect(() => store.applyFacts([set("0x8", "ResourceBalance", balance(7, "3", 2))])).toThrow(
      "Conflicting native keys",
    );
    expect(() => store.applyFacts([set("0xa", "ResourceBalance", balance(7, "3", 1))])).toThrow(
      "Conflicting native keys",
    );
  });

  it("keeps event delivery ephemeral and allows subscribers to detach", () => {
    const store = new NativeFactStore();
    let calls = 0;
    const detach = store.subscribe(() => calls++);
    store.applyEvent({ model: "StoryEvent", key: "0x1", value: { value: "story" } });
    expect(calls).toBe(0);
    store.applyFacts([set("0x8", "ResourceBalance", balance(7, "1"))]);
    detach();
    store.applyFacts([set("0x8", "ResourceBalance", balance(7, "2"))]);
    expect(calls).toBe(1);
  });

  it("updates the ownership index atomically when a structure changes hands", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x7", "Structure", structure("0x123"))]);
    let current: NativeRows["Structure"][] = [];
    store.subscribe(() => {
      expect([...store.structuresOwnedBy(1, 0x123n)]).toEqual([]);
      current = [...store.structuresOwnedBy(1, 0x456n)];
    });
    store.applyFacts([set("0x7", "Structure", structure("0x456"))]);
    expect(current).toHaveLength(1);
    expect(current[0].owner).toBe(0x456n);
  });
});
