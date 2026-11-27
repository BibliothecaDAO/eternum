import { gameRegistryRow } from "../test-support/game-registry";
import {
  BiomeType,
  BiomeTypeToId,
  getNeighborHexes,
  RESOURCE_PRECISION,
  StructureType,
  TileOccupier,
} from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";
import release from "../../../../contracts/l3/world-native/schema/release-definition.json";
import {
  nativeTilePackingConstants,
  type NativeModelName,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeOathConstants, nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { NativeFactStore } from "../client/native-fact-store";
import { nativeRowDefinitions } from "../client/native-row";
import { ClientConfigManager } from "../managers/config-manager";
import { forecastAttack, type AttackForecast } from "./attack-forecast";
import { deepCenter } from "./deep-geometry";
import { dayAtIndex } from "./days";
import { logisticsStamina } from "./attribute-tiers";
import { setBlockTimestampSource } from "./timestamp";

const GAME_ID = 28;
const DAY = 14_400;
const START = 1_000_000;
const NOW = START + 600;
const SPACING = 1024;
const DEEP = deepCenter(SPACING);
const RIVAL = 0xdefn;
const PLAYER = 0xabcn;
const troops = (count: number) => BigInt(count) * BigInt(RESOURCE_PRECISION);
const NO_BOOSTS = {
  incr_damage_dealt_percent_num: 0,
  incr_damage_dealt_end_at: 0,
  decr_damage_gotten_percent_num: 0,
  decr_damage_gotten_end_at: 0,
  incr_stamina_regen_percent_num: 0,
  incr_stamina_regen_seconds_left: 0,
  incr_explore_reward_percent_num: 0,
  incr_explore_reward_end_at: 0,
};

type Tile = { col: number; row: number; alt?: boolean };
type Category = "Knight" | "Crossbowman" | "Paladin";

function frontier() {
  ClientConfigManager.instance().setActiveGame(GAME_ID);
  setBlockTimestampSource(() => NOW);
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: GAME_ID, complete: true, actor: `0x${PLAYER.toString(16)}`, timestamp: NOW });
  const ids = new Map<string, string>();
  const write = (model: NativeModelName, value: Record<string, unknown>) => {
    const identity = `${model}:${nativeRowDefinitions[model].keys.map((key) => String(value[key])).join(":")}`;
    const id = ids.get(identity) ?? `0x${(ids.size + 1).toString(16)}`;
    ids.set(identity, id);
    store.applyFacts([{ model, key: id, value }]);
  };
  write("SliceRules", {
    ...release.definition.rules,
    game_id: GAME_ID,
    day_unit_seconds: DAY,
    battle_config: { ...release.definition.rules.battle_config, regular_immunity_ticks: 0 },
    troop_stamina_config: {
      ...release.definition.rules.troop_stamina_config,
      stamina_attack_req: 10,
      stamina_defense_req: 0,
    },
  });
  const tickSeconds = Number(release.definition.rules.tick_config.armies_tick_in_seconds);
  write("DeepTick", { game_id: GAME_ID, paid_tick: Math.floor(NOW / tickSeconds) });
  ClientConfigManager.instance().setStore(store);
  write("SettlementRules", {
    game_id: GAME_ID,
    registration_start: 0,
    registration_limit: 100,
    mode: "Triple",
    spacing: SPACING,
  });
  write(
    "GameRegistry",
    gameRegistryRow({
      game_id: GAME_ID,
      name: "0",
      start_settling_at: "0",
      start_main_at: String(START),
      scheduled_end_at: String(START + DAY * 50),
      end_at: String(START + DAY * 50),
      seed: "0",
    }),
  );
  write("DeepRules", {
    game_id: GAME_ID,
    gate_distance: 4,
    rings: [
      { radius: 5, realms: 0 },
      { radius: 8, realms: 30 },
    ],
    beasts: [
      { count: troops(10_000), bow: false },
      { count: troops(10_000), bow: true },
      { count: troops(10_000), bow: false },
      { count: troops(10_000), bow: true },
    ],
    loss_per_tick: troops(100),
    core_per_tick: troops(500),
    mine_per_tick: troops(500),
    building_pay: { alone: 6, pair: 3, crowd: 2 },
    altar_threshold: 1500,
  });

  const seats = new Map<number, string>();
  const occupy = (entity_id: number, tile: Tile, category: number, is_structure: boolean) => {
    const previous = seats.get(entity_id);
    if (previous) store.applyFacts([{ model: "TileOccupancy", key: previous, value: null }]);
    const id = `0x${(0x10000 + ids.size + 1).toString(16)}`;
    ids.set(`seat:${id}`, id);
    seats.set(entity_id, id);
    const { col, row } = tile;
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: id,
        value: { game_id: GAME_ID, alt: tile.alt ?? false, col, row, entity_id, category, is_structure },
      },
    ]);
  };

  const home = (entity_id: number, owner: bigint, aspect: number) => {
    write("Structure", structureRow(entity_id, owner, StructureType.Realm));
    write("HomeAspect", { game_id: GAME_ID, home: entity_id, aspect });
  };

  const army = (
    explorer_id: number,
    owner: number,
    tile: Tile,
    {
      count = 1_000,
      category = "Knight" as Category,
      oathPick = 0,
      day = 0,
      cooldownEnd = 0,
      bladeRank = 0,
      logistics = 0,
      stamina = 100n,
      oaths = 0,
    } = {},
  ) => {
    const slotted = logistics > 0;
    write("ExplorerTroops", {
      game_id: GAME_ID,
      explorer_id,
      owner,
      troops: {
        category,
        tier: "T1",
        count: troops(count),
        stamina: slotted ? { Slot: 0 } : { Inline: { amount: stamina, settled_at: NOW, remainder: 0 } },
        boosts: NO_BOOSTS,
        battle_cooldown_end: cooldownEnd,
      },
    });
    if (slotted)
      write("ArmySlot", {
        game_id: GAME_ID,
        structure_id: owner,
        epoch: BigInt(day),
        slot: 0,
        explorer_id,
        stamina: { amount: stamina, settled_at: NOW, remainder: 0 },
      });
    occupy(explorer_id, tile, TileOccupier.ExplorerKnightT1, false);
    write("ArmyProgress", {
      game_id: GAME_ID,
      explorer_id,
      logistics,
      oath_slots: 1,
      oaths,
      oath_pick: oathPick,
    });
    write("ArmyDay", { game_id: GAME_ID, explorer_id, day: BigInt(day) });
    for (const kind of ["Blade", "Ward", "Plunder", "StaminaRegen"]) {
      const rank = kind === "Blade" ? bladeRank : 0;
      write("ArmyRelicEffect", { game_id: GAME_ID, explorer_id, kind, rank, expires_at: rank ? BigInt(NOW + 60) : 0n });
    }
  };

  const guardRow = (structure_id: number, slot: number, count: number, category: Category = "Knight") => ({
    game_id: GAME_ID,
    structure_id,
    slot,
    troops: {
      category,
      tier: "T1",
      count: troops(count),
      stamina: { Inline: { amount: 100n, settled_at: NOW, remainder: 0 } },
      boosts: NO_BOOSTS,
      battle_cooldown_end: 0,
    },
    destroyed_tick: 0,
    oaths: 0,
  });

  const deepSite = (entity_id: number, tile: Tile, beast: number, ring = 0, aspect = 0) => {
    write("Structure", structureRow(entity_id, 0n, StructureType.DeepSite));
    write("DeepSite", { game_id: GAME_ID, entity_id, kind: nativeRuleConstants.DEEP_MINE, ring, day: 0n, aspect });
    occupy(entity_id, tile, TileOccupier.DeepSite, true);
    if (aspect === 0) write("Guard", guardRow(entity_id, 0, beast));
  };

  const holdDeepSite = (site_id: number, tile: Tile, aspect: number, home: number, count: number, slot = 1) => {
    deepSite(site_id, tile, 0, 0, aspect);
    const owner = store.require("Structure", { game_id: GAME_ID, entity_id: home }).owner;
    write("Structure", structureRow(site_id, owner, StructureType.DeepSite));
    write("GarrisonSlot", { game_id: GAME_ID, structure_id: site_id, slot, home });
    write("Guard", guardRow(site_id, slot, count));
  };

  const enterDeep = (count: number) => write("DeepEntries", { game_id: GAME_ID, day: 0n, count });

  const camp = (entity_id: number, tile: Tile, guards: [number, Category][]) => {
    write("Structure", structureRow(entity_id, 0n, StructureType.Camp));
    occupy(entity_id, tile, TileOccupier.Camp, true);
    write("TileOpt", {
      game_id: GAME_ID,
      alt: false,
      col: tile.col,
      row: tile.row,
      data: BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE),
    });
    write("ExpeditionSite", {
      game_id: GAME_ID,
      entity_id,
      category: StructureType.Camp,
      initial_guard_count: troops(guards.reduce((sum, [count]) => sum + count, 0)),
      alt: false,
      col: tile.col,
      row: tile.row,
      clear: null,
    });
    for (let slot = 0; slot < 4; slot += 1) {
      const [count, category] = guards[slot] ?? [0, "Knight"];
      write("Guard", guardRow(entity_id, slot, count, category));
    }
  };

  const guardedPost = (entity_id: number, tile: Tile, owner: bigint, aspect: number, guards: [number, Category][]) => {
    write("Structure", structureRow(entity_id, owner, StructureType.Camp));
    write("HomeAspect", { game_id: GAME_ID, home: entity_id, aspect });
    occupy(entity_id, tile, TileOccupier.Camp, true);
    for (let slot = 0; slot < 4; slot += 1) {
      const [count, category] = guards[slot] ?? [0, "Knight"];
      write("Guard", guardRow(entity_id, slot, count, category));
    }
  };

  const forecast = (
    attacker: number,
    target: number,
    at = NOW,
    options?: { besideTarget?: boolean; guardSlot?: number },
  ) =>
    forecastAttack(
      store,
      { game_id: GAME_ID, entity_id: attacker },
      { game_id: GAME_ID, entity_id: target },
      at,
      options,
    );

  const terrain = (tile: Tile, biome: BiomeType = BiomeType.Grassland) =>
    write("TileOpt", {
      game_id: GAME_ID,
      alt: tile.alt ?? false,
      col: tile.col,
      row: tile.row,
      data: BigInt(BiomeTypeToId[biome]) * BigInt(nativeTilePackingConstants.BIOME_SCALE),
    });

  return { home, army, deepSite, holdDeepSite, enterDeep, camp, guardedPost, terrain, write, forecast };
}

const structureRow = (entity_id: number, owner: bigint, category: number) => ({
  game_id: GAME_ID,
  entity_id,
  owner,
  base: {
    category,
    level: 1,
    troop_max_guard_count: 4,
    troop_max_explorer_count: 3,
    created_at: 0,
    starting_troops_granted: true,
  },
  metadata: { realm_id: entity_id, order: 1, has_wonder: false, village_realm: 0n, mine_kind: 0, deepest_depth: 0 },
  resources_packed: 0n,
});

const refusalOf = (forecast: AttackForecast | undefined) =>
  forecast?.outcome === "refused" ? forecast.refusal : forecast?.outcome;

const guardLoss = (forecast: AttackForecast | undefined) =>
  forecast?.outcome === "fights" ? forecast.exchange.defenderLoss : undefined;

const beside = (tile: Tile, steps = 1): Tile => ({ col: tile.col + steps, row: tile.row });

describe("one attack forecast for every combat surface", () => {
  afterEach(() => setBlockTimestampSource(null));

  it("refuses a bow two tiles from a Deep site, which only an adjacent army may attack (4978e3)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 300);
    game.army(10, 1, beside(DEEP, 2), { category: "Crossbowman" });
    expect(refusalOf(game.forecast(10, 50))).toBe("out-of-range");
    game.army(10, 1, beside(DEEP), { category: "Crossbowman" });
    expect(refusalOf(game.forecast(10, 50))).toBe("fights");
  });

  it("refuses a site of a ring not yet opened by today's Realms entered, then fights it once it opens", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 300, 1);
    game.army(10, 1, beside(DEEP));
    expect(refusalOf(game.forecast(10, 50))).toBe("deep-ring-closed");
    game.enterDeep(29);
    expect(refusalOf(game.forecast(10, 50))).toBe("deep-ring-closed");
    game.enterDeep(30);
    expect(refusalOf(game.forecast(10, 50))).toBe("fights");
  });

  it("refuses to fight a Deep site its own Aspect holds, and fights a rival Aspect's garrison (c3fd60)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.home(2, RIVAL, 2);
    game.army(10, 1, beside(DEEP));
    game.holdDeepSite(50, DEEP, 1, 1, 500);
    expect(refusalOf(game.forecast(10, 50))).toBe("allied");
    game.holdDeepSite(50, DEEP, 2, 2, 500);
    const forecast = game.forecast(10, 50);
    expect(forecast?.outcome).toBe("fights");
    expect(forecast?.sides?.defender).toMatchObject({ guarding: true, home: 2n });
    expect(forecast?.sides?.defender?.troops.count).toBe(troops(500));
  });

  it("does not offer a free claim while the next day's beast is awaiting settlement", () => {
    const game = frontier();
    const tomorrow = dayAtIndex(
      { seed: 0n, startMainAt: START, scheduledEndAt: START + DAY * 50, endAt: START + DAY * 50, dayUnitSeconds: DAY },
      0,
    ).end;
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 0);
    game.army(10, 1, beside(DEEP));
    expect(game.forecast(10, 50)?.outcome).toBe("claims");
    game.army(10, 1, beside(DEEP), { day: 1 });
    expect(game.forecast(10, 50, tomorrow)).toBeUndefined();
  });

  it("faces a structure's highest occupied guard slot, with the slots below it queued (c00cf4)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    const site = { col: 100, row: 100 };
    game.camp(60, site, [
      [1_000, "Knight"],
      [100, "Crossbowman"],
    ]);
    game.army(10, 1, beside(site));
    const forecast = game.forecast(10, 60);
    expect(forecast?.outcome).toBe("fights");
    expect(forecast?.sides?.defender?.troops).toMatchObject({ category: "Crossbowman", count: troops(100) });
    expect(forecast?.sides?.queued.map((guard) => guard.troops.count)).toEqual([troops(1_000)]);
  });

  it("refuses an army with an open Oath pick, then an army from an earlier day (966d43)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 300);
    game.army(10, 1, beside(DEEP), { oathPick: 1 });
    const pending = game.forecast(10, 50);
    expect(refusalOf(pending)).toBe("answer-oath-first");
    expect(pending?.sides?.attacker.troops.count).toBe(troops(1_000));
    expect(pending?.sides?.defender?.troops.count).toBe(troops(300));
    game.army(10, 1, beside(DEEP));
    const calendar = { seed: 0n, startMainAt: START, endAt: START + DAY * 50, scheduledEndAt: START + DAY * 50 };
    const tomorrow = dayAtIndex({ ...calendar, dayUnitSeconds: DAY }, 0).end;
    expect(refusalOf(game.forecast(10, 50, tomorrow))).toBe("expired-army");
  });

  it("fights rival armies without guard protection and refuses allies, own armies, and out-of-range targets", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.home(2, RIVAL, 2);
    game.home(3, 0x999n, 1);
    const field = { col: 100, row: 100 };
    const besideField = beside(field);
    game.terrain(besideField);
    game.army(10, 1, field, { category: "Crossbowman" });
    game.army(20, 2, besideField, { category: "Knight" });
    game.army(30, 3, beside(field, 2));
    game.army(11, 1, beside(field, 3));

    const surfaceFight = game.forecast(10, 20);
    expect(surfaceFight?.outcome).toBe("fights");
    expect(refusalOf(game.forecast(10, 30))).toBe("allied");
    expect(refusalOf(game.forecast(10, 11))).toBe("own-target");

    const deepAttacker = beside(DEEP, 3);
    const deepDefender = { col: deepAttacker.col + 1, row: deepAttacker.row };
    const deepAlly = { col: deepAttacker.col - 1, row: deepAttacker.row };
    game.army(10, 1, deepAttacker, { category: "Crossbowman" });
    game.army(20, 2, deepDefender, { category: "Knight" });
    game.army(30, 3, deepAlly);
    const deepFight = game.forecast(10, 20);
    expect(deepFight?.outcome).toBe("fights");
    expect(deepFight?.outcome === "fights" ? deepFight.sides.defender.guarding : true).toBe(false);
    expect(refusalOf(game.forecast(10, 30))).toBe("allied");

    game.army(20, 2, { col: deepAttacker.col + 3, row: deepAttacker.row });
    expect(refusalOf(game.forecast(10, 20))).toBe("out-of-range");

    game.write("Structure", structureRow(4, 0x444n, StructureType.Realm));
    game.army(40, 4, { col: deepAttacker.col, row: deepAttacker.row + 1 });
    expect(() => game.forecast(10, 40)).toThrow("HomeAspect");

    game.write("SliceRules", {
      ...release.definition.rules,
      game_id: GAME_ID,
      day_unit_seconds: DAY,
      command_mask: "0",
      battle_config: { ...release.definition.rules.battle_config, regular_immunity_ticks: 0 },
      troop_stamina_config: {
        ...release.definition.rules.troop_stamina_config,
        stamina_attack_req: 10,
        stamina_defense_req: 0,
      },
    });
    game.army(10, 1, deepAttacker);
    game.army(20, 2, deepDefender);
    expect(refusalOf(game.forecast(10, 20))).toBe("no-attack");
  });

  it("judges the attacker's cooldown at the chain second it is given (addd1a)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 300);
    game.army(10, 1, beside(DEEP), { cooldownEnd: NOW + 30 });
    expect(refusalOf(game.forecast(10, 50))).toBe("cooldown");
    expect(refusalOf(game.forecast(10, 50, NOW + 30))).toBe("fights");
  });

  it("refuses a site with no guard left, which went to the army that beat its last guard", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    const site = { col: 100, row: 100 };
    game.camp(60, site, []);
    game.army(10, 1, beside(site), { category: "Crossbowman" });
    expect(refusalOf(game.forecast(10, 60))).toBe("unguarded-site");
  });

  it("refuses an attack past the troops' range and forecasts one from beside the target when asked", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    const site = { col: 100, row: 100 };
    game.camp(60, site, [[300, "Knight"]]);
    game.army(10, 1, beside(site, 5));
    expect(refusalOf(game.forecast(10, 60))).toBe("out-of-range");
    expect(refusalOf(game.forecast(10, 60, NOW, { besideTarget: true }))).toBe("fights");
  });

  it("refuses a structure's guard attacking an army, which stands in the open, from any distance (8f626c)", () => {
    const game = frontier();
    game.home(2, RIVAL, 2);
    game.guardedPost(70, DEEP, PLAYER, 1, [
      [500, "Knight"],
      [400, "Crossbowman"],
    ]);
    game.army(20, 2, beside(DEEP, 2));
    expect(refusalOf(game.forecast(70, 20))).toBe("out-of-range");
    game.army(20, 2, beside(DEEP));
    expect(refusalOf(game.forecast(70, 20))).toBe("no-attack");
  });

  it("counts the attacking army's active Blade in its damage (44985b)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 3_000);
    game.army(10, 1, beside(DEEP));
    const plain = guardLoss(game.forecast(10, 50));
    game.army(10, 1, beside(DEEP), { bladeRank: 1 });
    const bladed = guardLoss(game.forecast(10, 50));
    expect(plain).toBeDefined();
    expect(bladed!).toBeGreaterThan(plain!);
  });

  it("adds the Twins' share of the largest own army beside the attacker that is current today (3dc2f8)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.home(2, RIVAL, 2);
    game.deepSite(50, DEEP, 100_000);
    const at = beside(DEEP);
    const [first, second, third, fourth] = getNeighborHexes(at.col, at.row).filter(
      ({ col, row }) => col !== DEEP.col || row !== DEEP.row,
    );
    game.army(30, 1, at, { count: 2_000 });
    const companion = guardLoss(game.forecast(30, 50))!;
    game.army(30, 1, beside(DEEP, 4), { count: 2_000 });
    const twins = 1 << (nativeOathConstants.TWINS - 1);
    game.army(10, 1, at, { oaths: twins });
    const alone = guardLoss(game.forecast(10, 50))!;
    const precision = BigInt(RESOURCE_PRECISION);
    const share = ((companion * BigInt(nativeOathConstants.TWINS_DAMAGE_PERCENT)) / 100n / precision) * precision;
    expect(share).toBeGreaterThan(0n);
    game.army(30, 1, first!, { count: 2_000 });
    expect(guardLoss(game.forecast(10, 50))).toBe(alone + share);
    game.army(31, 1, second!, { count: 1_000 });
    game.army(20, 2, third!, { count: 5_000 });
    game.army(32, 1, fourth!, { count: 5_000, day: 1 });
    expect(guardLoss(game.forecast(10, 50))).toBe(alone + share);
    game.army(10, 1, at);
    expect(guardLoss(game.forecast(10, 50))).toBe(alone);
  });

  it("reads the attacking army's own stamina maximum, above its troop's base bar (4587f1)", () => {
    const game = frontier();
    game.home(1, PLAYER, 1);
    game.deepSite(50, DEEP, 300);
    const base = release.definition.rules.troop_stamina_config.stamina_knight_max;
    const maximum = base + logisticsStamina(5);
    game.army(10, 1, beside(DEEP), { logistics: 5, stamina: BigInt(maximum) });
    const forecast = game.forecast(10, 50);
    expect(forecast?.sides?.attacker.troops.staminaMax).toBe(maximum);
    expect(forecast?.outcome === "fights" && forecast.exchange.attacker.stamina.amount).toBeGreaterThan(base);
  });
});
