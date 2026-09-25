import { StaminaManager } from "../managers/stamina-manager";
import { configManager } from "../managers/config-manager";
import { musterStamina, openArmySlots, resolveExplorerTroops, troopStaminaLimits } from "../managers/troop-stamina";
import { afterEach, describe, expect, it, vi } from "vitest";
import rowFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { GameSyncFact } from "../sync/game-sync-types";
import { NativeFactStore } from "./native-fact-store";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { setBlockTimestampSource } from "../utils/timestamp";

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

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
    troop_max_guard_count: 0,
    troop_max_explorer_count: 0,
    starting_troops_granted: false,
  },
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
  it("decodes tagged stamina and refuses ambiguous or unknown sources", () => {
    const store = new NativeFactStore();
    for (const stamina of [{ Slot: 0 }, { Inline: { amount: "12", updated_tick: "4" } }]) {
      store.applyFacts([set("0x7", "ExplorerTroops", { ...explorer, troops: { ...explorer.troops, stamina } })]);
      const row = store.require("ExplorerTroops", { game_id: 1, explorer_id: 7 });
      if ("Inline" in stamina) expect(resolveExplorerTroops(store, row)?.stamina.amount).toBe(12n);
      else expect(row.troops.stamina).toEqual({ Slot: 0 });
    }
    for (const stamina of [
      { Slot: 0, Inline: { amount: "1", updated_tick: "1" } },
      { Unknown: 0 },
      { Inline: { amount: "1" } },
    ])
      expect(() =>
        store.applyFacts([set("0x7", "ExplorerTroops", { ...explorer, troops: { ...explorer.troops, stamina } })]),
      ).toThrow();
  });

  it("keeps home and position indexes atomic through movement, reassignment and death", () => {
    const store = new NativeFactStore();
    const tile = (col: number) => ({
      game_id: 1,
      alt: false,
      col,
      row: 34,
      entity_id: 7,
      category: 15,
      is_structure: false,
    });
    store.applyFacts([set("0x7", "ExplorerTroops", explorer), set("0x10", "TileOccupancy", tile(12))]);
    const owner = Number(explorer.owner);
    expect([...store.armiesAtHome(1, owner)]).toHaveLength(1);
    store.subscribe(() => {
      const army = store.get("ExplorerTroops", { game_id: 1, explorer_id: 7 });
      expect(store.entityOccupancy(1, 7)?.col).toBe(army ? 13 : undefined);
      expect([...store.armiesAtHome(1, owner)]).toEqual([]);
      expect([...store.armiesAtHome(1, 99)]).toHaveLength(army ? 1 : 0);
    });
    store.applyFacts([
      remove("0x10", "TileOccupancy"),
      set("0x11", "TileOccupancy", tile(13)),
      set("0x7", "ExplorerTroops", { ...explorer, owner: 99 }),
    ]);
    store.applyFacts([remove("0x7", "ExplorerTroops"), remove("0x11", "TileOccupancy")]);
  });

  it("keeps both spire layers and reservations by tile without entity positions", () => {
    const store = new NativeFactStore();
    const tile = { game_id: 1, col: 12, row: 34, entity_id: 8, category: 35, is_structure: true };
    store.applyFacts([
      set("0x10", "TileOccupancy", { ...tile, alt: false }),
      set("0x11", "TileOccupancy", { ...tile, alt: true }),
      set("0x12", "TileOccupancy", { ...tile, alt: false, col: 13, entity_id: 0, category: 39 }),
    ]);
    for (const alt of [false, true])
      expect(store.require("TileOccupancy", { game_id: 1, alt, col: 12, row: 34 }).entity_id).toBe(8);
    expect(store.entityOccupancy(1, 8)).toBeUndefined();
    expect(store.entityOccupancy(1, 0)).toBeUndefined();
    store.applyFacts([set("0x12", "TileOccupancy", { ...tile, alt: false, col: 13, entity_id: 9, category: 9 })]);
    expect(store.entityOccupancy(1, 9)?.col).toBe(13);
    expect(store.entityOccupancy(1, 0)).toBeUndefined();
  });

  it("preserves absent map overrides and validates present overrides atomically", () => {
    const store = new NativeFactStore();
    const overrides: NativeRows["GameOverrides"] = {
      game_id: 1,
      registration_start: 100,
      biome_climate: {
        elevation_scale_bps: 10000,
        moisture_scale_bps: 10000,
        elevation_bias_bps: 0,
        moisture_bias_bps: 0,
        elevation_seed: 1,
        moisture_seed: 2,
      },
      map: null,
      map_center_offset: 42,
    };
    store.applyFacts([set("0x1", "GameOverrides", overrides)]);
    expect(store.require("GameOverrides", { game_id: 1 }).map).toBeNull();
    const map: NonNullable<NativeRows["GameOverrides"]["map"]> = {
      shards_mines_win_probability: 0,
      shards_mines_fail_probability: 1,
      camp_win_probability: 1,
      camp_fail_probability: 0,
      holysite_win_probability: 0,
      holysite_fail_probability: 1,
      bitcoin_mine_win_probability: 0,
      bitcoin_mine_fail_probability: 1,
      hyps_win_prob: 0,
      hyps_fail_prob: 1,
      hyps_fail_prob_increase_p_hex: 0,
      hyps_fail_prob_increase_p_fnd: 0,
      relic_discovery_interval_sec: 60000,
      relic_hex_dist_from_center: 10,
      relic_chest_relics_per_chest: 1,
    };
    store.applyFacts([set("0x1", "GameOverrides", { ...overrides, map })]);
    const stored = store.require("GameOverrides", { game_id: 1 });
    expect(stored.map).toEqual(map);
    expect(Object.isFrozen(stored.map)).toBe(true);
    expect(() => store.applyFacts([set("0x1", "GameOverrides", { ...overrides, map: {} })])).toThrow(
      "Unexpected fields in GameOverrides.map",
    );
    expect(store.require("GameOverrides", { game_id: 1 })).toBe(stored);
    expect(() => store.applyFacts([set("0x1", "GameOverrides", { ...overrides, map: undefined })])).toThrow(
      "Invalid row in GameOverrides.map",
    );
  });

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
    expect(row).not.toHaveProperty("coord");
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

describe("declared fact absence", () => {
  it("requires the current actor snapshot for nonce and points zeroes, without storing synthetic rows", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 0 })]);
    let complete = false;
    let actor: string | undefined = undefined;
    const update = () => store.setSnapshot({ gameId: 1, complete, actor, timestamp: 350 });
    update();
    const nonce = { game_id: 1, actor: 0x111n };
    const points = { game_id: 1, address: 0x111n };
    expect(store.requireOrAbsent("ActionNonce", nonce).unknown).toContain("INCOMPLETE_SNAPSHOT");
    complete = true;
    update();
    expect(store.requireOrAbsent("ActionNonce", nonce).unknown).toContain("INCOMPLETE_ACTOR_SNAPSHOT");
    actor = "0x111";
    update();
    expect(store.requireOrAbsent("ActionNonce", nonce).known?.next_nonce).toBe(0n);
    expect(store.requireOrAbsent("PlayerPoints", points).known?.points).toBe(0n);
    expect([...store.rows("ActionNonce")]).toEqual([]);
    expect([...store.rows("PlayerPoints")]).toEqual([]);
    expect(store.requireOrAbsent("PlayerPoints", { ...points, address: 0x222n }).known?.points).toBe(0n);
    expect(store.requireOrAbsent("ActionNonce", { ...nonce, actor: 0x222n }).unknown).toContain(
      "OUTSIDE_SNAPSHOT_SCOPE",
    );
    expect(store.requireOrAbsent("ActionNonce", { ...nonce, game_id: 2 }).unknown).toContain("INCOMPLETE_SNAPSHOT");
    actor = undefined;
    update();
    expect(store.requireOrAbsent("ActionNonce", nonce).unknown).toContain("INCOMPLETE_ACTOR_SNAPSHOT");
    store.applyFacts([set("0x1", "ActionNonce", { ...nonce, next_nonce: "9" })]);
    expect(store.requireOrAbsent("ActionNonce", nonce).known?.next_nonce).toBe(9n);
    expect(store.requireOrAbsent("GameRegistry", { game_id: 1 }).unknown).toContain("UNDECLARED_ABSENCE");
  });

  it("waits for the last snapshot page, requires the parent, and forgets zero after parent deletion", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 0 })]);
    let complete = false;
    const update = () => store.setSnapshot({ gameId: 1, complete, actor: null, timestamp: 350 });
    update();
    const key = { game_id: 1, entity_id: 7 };
    store.applyFacts([set("0x7", "Structure", structure("0x111"))]);
    expect(store.requireOrAbsent("ProductionBonus", key).unknown).toContain("INCOMPLETE_SNAPSHOT");
    complete = true;
    update();
    expect(store.requireOrAbsent("ProductionBonus", key).known?.incr_labor_rate_percent_num).toBe(0);
    expect(store.requireOrAbsent("VillageRaid", key).known?.last_tick).toBe(0n);
    const guard = store.requireOrAbsent("Guard", { game_id: 1, structure_id: 7, slot: 1 });
    expect(guard.known?.troops.count).toBe(0n);
    expect(guard.known?.destroyed_tick).toBe(0);
    expect(store.requireOrAbsent("ProductionBonus", { ...key, entity_id: 8 }).unknown).toContain("UNKNOWN_PARENT");
    // A remote production row does not prove the presence of its resource owner.
    expect(store.requireOrAbsent("ResourceBalance", { ...key, resource_type: 1 }).unknown).toContain("UNKNOWN_PARENT");
    store.applyFacts([remove("0x7", "Structure")]);
    expect(store.requireOrAbsent("VillageRaid", key).unknown).toContain("UNKNOWN_PARENT");
  });
  it("uses the declared resource, hyperstructure and settlement parents", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 0 })]);
    store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 350 });
    const entity = { game_id: 1, entity_id: 7 };
    const resource = { ...entity, resource_type: 2 };
    store.applyFacts([
      set("0x1", "ResourceWeight", { ...entity, capacity: "100", weight: "0" }),
      set("0x2", "Hyperstructure", { ...entity, stage: "Construction", access: "Public", seed: "12" }),
      set("0x3", "SettlementRules", {
        game_id: 1,
        registration_start: 1,
        registration_limit: 2,
        spacing: 10,
        mode: "Single",
      }),
    ]);
    expect(store.requireOrAbsent("ResourceBalance", resource).known?.balance).toBe(0n);
    expect(store.requireOrAbsent("ResourceProduction", resource).known).toMatchObject({
      building_count: 0,
      production_rate: 0n,
      output_amount_left: 0n,
      last_updated_at: 0,
    });
    expect(store.requireOrAbsent("HyperstructureProgress", resource).known?.contributed).toBe(0n);
    expect(store.requireOrAbsent("SettlementProgress", { game_id: 1 }).known).toEqual({
      game_id: 1,
      registered: 0,
      realm_count: 0,
    });
    store.applyFacts([set("0x4", "ResourceBalance", { ...resource, balance: "19" })]);
    expect(store.requireOrAbsent("ResourceBalance", resource).known?.balance).toBe(19n);
    store.applyFacts([remove("0x4", "ResourceBalance")]);
    expect(store.requireOrAbsent("ResourceBalance", resource).known?.balance).toBe(0n);
  });

  it("never invents a chest counter for another actor or an unobserved Frontier day", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 0 })]);
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
    store.applyFacts([
      set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 }),
      set("0x2", "SettlementRules", {
        game_id: 1,
        registration_start: 1,
        registration_limit: 2,
        spacing: 10,
        mode: "Single",
      }),
      set("0x3", "GameRegistry", {
        game_id: 1,
        preset_id: 3,
        name: "1",
        creator: "1",
        start_settling_at: "1",
        start_main_at: "100",
        end_at: "1000",
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: "1",
      }),
    ]);
    setBlockTimestampSource(() => 350);
    store.applyFacts([set("0x7", "Structure", structure("0x111"))]);
    const slot = { game_id: 1, structure_id: 7, epoch: 3n, slot: 0 };
    expect(store.requireOrAbsent("ArmySlot", slot)).toEqual({ unused: true });
    const army = {
      ...explorer,
      game_id: 1,
      explorer_id: 7,
      owner: 7,
      troops: { ...explorer.troops, stamina: { Slot: 0 } },
    } as unknown as NativeRows["ExplorerTroops"];
    expect(resolveExplorerTroops(new NativeFactStore(), army)).toBeUndefined();
    expect(resolveExplorerTroops(store, { ...army, owner: 8 })).toBeUndefined();
    expect(() => resolveExplorerTroops(store, army)).toThrow("unused");
    const occupied = { ...slot, explorer_id: army.explorer_id, stamina: { amount: "7", updated_tick: "17" } };
    store.applyFacts([
      set("0x70", "ArmySlot", occupied),
      set("0x72", "ArmyProgress", {
        game_id: 1,
        explorer_id: army.explorer_id,
        level: 3,
        xp: 17,
        battle: 3,
        logistics: 3,
        scouting: 1,
        support: 1,
        pending: null,
      }),
    ]);
    expect(resolveExplorerTroops(store, army)?.stamina).toEqual({ amount: 7n, updated_tick: 17n });
    expect(resolveExplorerTroops(store, army)?.staminaMax).toBe(
      Number(preset.rules.troop_stamina_config.stamina_knight_max) + 60,
    );
    expect(resolveExplorerTroops(store, army)?.boosts.incr_damage_dealt_percent_num).toBe(20);
    store.applyFacts([set("0x70", "ArmySlot", { ...occupied, explorer_id: army.explorer_id + 1 })]);
    expect(() => resolveExplorerTroops(store, army)).toThrow("occupant mismatch");
    store.applyFacts([remove("0x70", "ArmySlot")]);
    store.applyFacts([set("0x71", "ChestTokens", { game_id: 1, player: "0x111", epoch: "3", count: 1 })]);
    expect(store.requireOrAbsent("ChestTokens", { game_id: 1, player: 0x111n, epoch: 3n }).known?.count).toBe(1);

    expect(store.requireOrAbsent("ArmySlot", { ...slot, epoch: 2n }).unknown).toContain("OUTSIDE_SNAPSHOT_SCOPE");
    expect(store.requireOrAbsent("ArmySlot", { ...slot, structure_id: 8 }).unknown).toContain("OUTSIDE_SNAPSHOT_SCOPE");
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
    expect(store.requireOrAbsent("ArmySlot", slot).unknown).toContain("INCOMPLETE_SNAPSHOT");
    expect(resolveExplorerTroops(store, army)).toBeUndefined();
    store.applyFacts([set("0x72", "ExplorerTroops", army)]);
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    expect(new StaminaManager(store, army.explorer_id).getStamina(17)).toBeUndefined();
    store.setSnapshot({ gameId: 1, complete: true, timestamp: 350 });
    expect(resolveExplorerTroops(store, army)).toBeUndefined();
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
    expect(store.requireOrAbsent("ChestPity", { game_id: 1, player: 0x111n, depth: 3 }).known?.count).toBe(0);
    expect(store.requireOrAbsent("ChestTokens", { game_id: 1, player: 0x111n, epoch: 3n }).known?.count).toBe(1);
    expect(store.requireOrAbsent("ChestPity", { game_id: 1, player: 0x222n, depth: 3 }).unknown).toContain(
      "OUTSIDE_SNAPSHOT_SCOPE",
    );
    for (const epoch of [1n, 2n])
      expect(store.requireOrAbsent("ChestTokens", { game_id: 1, player: 0x111n, epoch }).unknown).toContain(
        "OUTSIDE_SNAPSHOT_SCOPE",
      );
  });
  it("musters into the lowest vacant slot, on a fresh bar or the one its last army left", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 })]);
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
    store.applyFacts([
      set("0x2", "SettlementRules", {
        game_id: 1,
        registration_start: 1,
        registration_limit: 2,
        spacing: 10,
        mode: "Single",
      }),
      set("0x3", "GameRegistry", {
        game_id: 1,
        preset_id: 3,
        name: "1",
        creator: "1",
        start_settling_at: "1",
        start_main_at: "100",
        end_at: "1000",
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: "1",
      }),
      set("0x7", "Structure", structure("0x111")),
    ]);
    setBlockTimestampSource(() => 350);
    const home = { game_id: 1, entity_id: 7, allowedSlots: 3 };
    const slot = (index: number, explorerId: number, amount: string) =>
      set(`0x8${index}`, "ArmySlot", {
        game_id: 1,
        structure_id: 7,
        epoch: "3",
        slot: index,
        explorer_id: explorerId,
        stamina: { amount, updated_tick: "10" },
      });

    expect(openArmySlots(store, home)?.map((open) => open.inherited)).toEqual([null, null, null]);
    // Slot 0 holds an army; slot 1's army died today and left its bar behind.
    store.applyFacts([slot(0, 70, "30"), slot(1, 0, "4")]);
    const open = openArmySlots(store, home)!;
    expect(open).toEqual([
      { slot: 1, inherited: { amount: 4n, updated_tick: 10n } },
      { slot: 2, inherited: null },
    ]);

    const rules = store.get("SliceRules", { game_id: 1 })!.troop_stamina_config;
    const knight = { category: "Knight", tier: "T1" } as const;
    const { staminaInitial, staminaMax } = troopStaminaLimits(rules, knight.category, knight.tier);
    expect(musterStamina(open[0], knight, 12, rules)).toEqual({
      amount: Math.min(4 + 2 * Number(rules.stamina_gain_per_tick), staminaMax),
      max: staminaMax,
    });
    expect(musterStamina(open[1], knight, 12, rules)).toEqual({
      amount: Math.min(staminaInitial, staminaMax),
      max: staminaMax,
    });

    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
    expect(openArmySlots(store, home)).toBeUndefined();
  });
  // Pinned to the contract's gate expedition_slot_reuse_preserves_its_bar_and_midnight_allocates_a_fresh_bar
  // (world-native registrar tests): a slot released at 7 hands exactly 7 to an army mustered in the same tick, and
  // the next epoch's first muster in that slot starts on stamina_initial.
  it("promises the bar the contract's allocate hands on", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 })]);
    const day = (timestamp: number) => {
      store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp });
      setBlockTimestampSource(() => timestamp);
    };
    day(351);
    store.applyFacts([
      set("0x2", "SettlementRules", {
        game_id: 1,
        registration_start: 1,
        registration_limit: 2,
        spacing: 10,
        mode: "Single",
      }),
      set("0x3", "GameRegistry", {
        game_id: 1,
        preset_id: 3,
        name: "1",
        creator: "1",
        start_settling_at: "1",
        start_main_at: "100",
        end_at: "1000",
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: "1",
      }),
      set("0x7", "Structure", structure("0x111")),
      set("0x80", "ArmySlot", {
        game_id: 1,
        structure_id: 7,
        epoch: "3",
        slot: 0,
        explorer_id: 0,
        stamina: { amount: "7", updated_tick: "35" },
      }),
    ]);
    const home = { game_id: 1, entity_id: 7, allowedSlots: 2 };
    const rules = store.get("SliceRules", { game_id: 1 })!.troop_stamina_config;
    const knight = { category: "Knight", tier: "T1" } as const;

    const released = openArmySlots(store, home)![0];
    expect(released.slot).toBe(0);
    expect(musterStamina(released, knight, 35, rules).amount).toBe(7);

    day(400);
    const nextDay = openArmySlots(store, home)![0];
    expect(nextDay).toEqual({ slot: 0, inherited: null });
    expect(musterStamina(nextDay, knight, 40, rules).amount).toBe(Number(rules.stamina_initial));
  });
  it("keeps incomplete scope invariants out of synchronous listeners", () => {
    const store = new NativeFactStore();
    const seen: (string | undefined)[] = [];
    store.subscribe(() => seen.push(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0x111n }).unknown));
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
    store.applyFacts([
      set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 }),
      set("0x2", "SettlementRules", {
        game_id: 1,
        registration_start: 1,
        registration_limit: 2,
        spacing: 10,
        mode: "Single",
      }),
      set("0x3", "GameRegistry", {
        game_id: 1,
        preset_id: 3,
        name: "1",
        creator: "1",
        start_settling_at: "1",
        start_main_at: "100",
        end_at: "1000",
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: "1",
      }),
    ]);
    store.applyFacts([
      set("0x7", "Structure", structure("0x111")),
      set("0x8", "ExplorerTroops", { ...explorer, owner: 7, troops: { ...explorer.troops, count: "1" } }),
    ]);
    expect(seen.every((reason) => reason?.startsWith("INCOMPLETE_SNAPSHOT"))).toBe(true);
    expect(() => store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 })).not.toThrow();
    expect(seen.at(-1)).toContain("INCOMPLETE_SCOPE: Expected one position for scope entity");
    expect(() =>
      store.applyFacts([set("0x9", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: "1", weight: "0" })]),
    ).not.toThrow();
    expect(seen.at(-1)).toContain("INCOMPLETE_SCOPE: Expected one position for scope entity");
  });

  it("notifies sparse readers when gates open, while actor nonces ignore expedition clock", () => {
    const store = new NativeFactStore();
    store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 })]);
    const state = { gameId: 1, complete: false, actor: "0x111", timestamp: undefined };
    const values: unknown[] = [];
    store.subscribe(() => values.push(store.requireOrAbsent("ActionNonce", { game_id: 1, actor: 0x111n })));
    store.setSnapshot(state);
    const revision = store.getRevision();
    store.setSnapshot({ ...state, complete: true });
    expect(store.getRevision()).toBe(revision + 1);
    expect(values.at(-1)).toEqual({ known: { game_id: 1, actor: 0x111n, next_nonce: 0n } });
    expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0x111n }).unknown).toContain(
      "INCOMPLETE_SCOPE",
    );
    expect(store.subscriptionScope()).toBe(store.subscriptionScope());
    store.setSnapshot({ ...state, complete: true, actor: "0x222" });
    expect(store.requireOrAbsent("ActionNonce", { game_id: 1, actor: 0x222n }).known?.next_nonce).toBe(0n);
    expect(store.requireOrAbsent("ActionNonce", { game_id: 1, actor: 0x111n }).unknown).toContain(
      "OUTSIDE_SNAPSHOT_SCOPE",
    );
  });
});
