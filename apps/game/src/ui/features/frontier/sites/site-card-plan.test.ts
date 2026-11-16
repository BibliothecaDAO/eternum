import { deepBattleTargetScenario } from "@/lab/game/battle-target-scenario";
import { readDeepSites } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";
import { afterEach, describe, expect, it } from "vitest";
import { armyRelicReward, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { BiomeType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { readDeepSiteFight, readArmyCard, readSiteCard } from "./site-card-plan";
import { blightglowRift, campBeside, otherArmyAt, relicEffectFact, reloadSiteFacts, SITE_TILE } from "./site-fixture";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's tile card", () => {
  it("shows a camp's guard as troops and tier, its labor payout, and the exact fight from the army beside it", () => {
    const { store, site, structure, attack } = campBeside();
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    expect(plan.name).toBe("Troll");
    expect(plan.beast?.beast).toBe("troll");
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_100 });
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 825, fits: 825 });
    expect(plan.attackStamina).toBe(preset.rules.troop_stamina_config.stamina_attack_req);
    // The one attack Attack sends now, as the contract resolves it and its result will show it: this attack's losses
    // and the guard it leaves standing (a second attack would clear the camp; the card speaks of none but this one).
    expect(plan.fight).toEqual({ troopsLost: 457, guardLeft: 478 });
  });

  it("refuses the attack of an army short of its stamina as the contract does, with no figures of a later fight", () => {
    const { store, site, structure, attack } = campBeside("Camp", true, 0n);
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    expect(plan.fight).toEqual({ refused: true });
    expect(plan.attackStamina).toBe(preset.rules.troop_stamina_config.stamina_attack_req);
  });

  it("forecasts an army out of reach as it would attack from beside the site, and none with no army selected", () => {
    const { store, site, structure, attack } = campBeside();
    const beside = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    const far = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 44, row: 12, alt: false }));
    expect(beside.inReach).toBe(true);
    expect(far.inReach).toBe(false);
    // The same army, stamina and biome: the attack its Move leads to is the one beside the site.
    expect(far.fight).toEqual({ troopsLost: 457, guardLeft: 478 });
    const armyless = readSiteCard(store, site, structure, SITE_TILE, null);
    expect(armyless.fight).toBeUndefined();
    expect(armyless.inReach).toBe(false);
  });

  it("distinguishes an unknown guard from an empty slot after the snapshot completes", () => {
    const { store, site, structure, attack } = campBeside("Camp", false);
    const army = attack({ col: 41, row: 12, alt: false });
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
    expect(readSiteCard(store, site, structure, SITE_TILE, army)).toMatchObject({
      guard: undefined,
      fight: undefined,
    });
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
    expect(readSiteCard(store, site, structure, SITE_TILE, army)).toMatchObject({
      guard: null,
      fight: undefined,
    });
  });

  it("names a ruin by the beast its depth calls for, and pays its chest", () => {
    setBlockTimestampSource(() => 350);
    const { store, site, structure } = campBeside("Ruin");
    // Row 12 of ten-row bands is the second band: Ethereal I, held by a basilisk.
    const plan = readSiteCard(store, site, structure, SITE_TILE, null);
    expect(plan.name).toBe("Basilisk");
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Lords, amount: 500, fits: 500 });
    expect(plan.chest).toMatchObject({ tier: 3, amount: 500, funded: true });
    expect(plan.ruinDepth).toBe("Ethereal I");
    const rift = campBeside("Rift");
    expect(readSiteCard(rift.store, rift.site, rift.structure, SITE_TILE, null).payout).toEqual({
      resourceId: ResourcesIds.Essence,
      amount: 4_950,
      fits: 4_950,
    });
  });
});

it("shows only the camp reward that fits in the home labor store", () => {
  const { store, site, structure, attack } = campBeside();
  const home = attack({ col: 41, row: 12, alt: false }).army.owner;
  const limit = BigInt(store.require("BoardRules", { game_id: 1 }).settlement_resource_cap) * 1_000_000_000n;
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: "0x79",
      value: {
        game_id: 1,
        entity_id: home,
        resource_type: ResourcesIds.Labor,
        balance: String(limit - 10n * 1_000_000_000n),
      },
    },
  ] as never);
  const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
  expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 825, fits: 10 });
});

it("reads another player's army as a target: its troops, the same exact fight near or far, and nothing it pays", () => {
  const { store, attack } = campBeside();
  const other = otherArmyAt(store, 42, 12);
  const plan = readArmyCard(store, other, { col: 42, row: 12, alt: false }, attack({ col: 41, row: 12, alt: false }));
  expect(plan.kind).toBe("Army");
  expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 300 });
  expect(plan.payout).toBeNull();
  expect(plan.fight).toEqual({ troopsLost: 134, guardLeft: 0 });
  expect(plan.inReach).toBe(true);
  const far = readArmyCard(store, other, { col: 44, row: 12, alt: false }, attack({ col: 41, row: 12, alt: false }));
  expect(far.inReach).toBe(false);
  expect(far.fight).toEqual(plan.fight);
});

it("shows a ruin's fixed quote but refuses funding when the shared budget is spent", () => {
  setBlockTimestampSource(() => 350);
  const { store, site, structure } = campBeside("Ruin");
  const budget = store.require("LordsBudget", { game_id: 1 });
  store.applyFacts([{ model: "LordsBudget", key: "0x101", value: { ...budget, pool_left: 0n } }]);
  expect(readSiteCard(store, site, structure, SITE_TILE, null).chest).toEqual({
    tier: 3,
    amount: 500,
    funded: false,
  });
});

it("shows Cyclops wheat from initial guards as its resource payout", () => {
  const { store, site, structure, attack } = campBeside("Beasts");
  const own = attack({ col: 41, row: 12, alt: false });
  const limit = BigInt(store.require("BoardRules", { game_id: 1 }).settlement_resource_cap) * 1_000_000_000n;
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: store.wireKeyOf("ResourceBalance", {
        game_id: 1,
        entity_id: own.army.owner,
        resource_type: ResourcesIds.Wheat,
      })!,
      value: {
        game_id: 1,
        entity_id: own.army.owner,
        resource_type: ResourcesIds.Wheat,
        balance: limit - 10_000_000_000n,
      },
    },
  ]);
  const plan = readSiteCard(store, site, structure, SITE_TILE, own);
  expect(plan.payout).toEqual({ resourceId: ResourcesIds.Wheat, amount: 6000, fits: 10 });
});

describe("the recorded Blightglow Rift under Frontier's current combat rules", () => {
  const card = (troops: bigint, guardStamina: bigint, armyStamina = 100n) => {
    const { store, site, structure, attack } = blightglowRift({ troops, guardStamina, armyStamina });
    return readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
  };

  it("forecasts the rested guard with the same formula as a field army", () => {
    const plan = card(794n, 120n);
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_400 });
    expect(plan.attackStamina).toBe(30);
    expect(plan.fight).toEqual({ troopsLost: 601, guardLeft: 1_059 });
  });

  it("keeps the guard's damage at full strength below its defense stamina cost", () => {
    expect(card(793n, 39n).fight).toEqual({ troopsLost: 601, guardLeft: 1_060 });
  });

  it("refuses the attack of an army below the attack's stamina, as the contract does", () => {
    expect(card(794n, 120n, 29n).fight).toEqual({ refused: true });
    expect(card(794n, 120n, 30n).fight).toEqual({ troopsLost: 601, guardLeft: 1_059 });
  });
});

it("forecasts Blade, Ward and Plunder at the attack second and drops them exactly at expiry", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  const read = (timestamp: number) => readSiteCard(store, site, structure, SITE_TILE, { ...action, timestamp });
  expect(read(350)).toMatchObject({ fight: { troopsLost: 457, guardLeft: 478 }, payout: { amount: 825 } });
  store.applyFacts([relicEffectFact("Blade"), relicEffectFact("Ward"), relicEffectFact("Plunder")]);
  expect(read(379)).toMatchObject({
    fight: { troopsLost: 434, guardLeft: 416 },
    payout: { amount: 990, fits: 990 },
  });
  expect(read(380)).toMatchObject({ fight: { troopsLost: 457, guardLeft: 478 }, payout: { amount: 825 } });
  expect(action.army.troops.boosts.incr_damage_dealt_percent_num).toBe(0);
  expect(action.army.troops.boosts.decr_damage_gotten_percent_num).toBe(0);
});

it("clips the Plunder reward after applying its bonus and leaves wheat unchanged", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  const limit = BigInt(store.require("BoardRules", { game_id: 1 }).settlement_resource_cap) * 1_000_000_000n;
  const keys = { game_id: 1, entity_id: action.army.owner, resource_type: ResourcesIds.Labor };
  store.applyFacts([
    relicEffectFact("Plunder"),
    { model: "ResourceBalance", key: "0x79", value: { ...keys, balance: limit - 900n * 1_000_000_000n } },
  ]);
  expect(readSiteCard(store, site, structure, SITE_TILE, action).payout).toEqual({
    resourceId: ResourcesIds.Labor,
    amount: 990,
    fits: 900,
  });
  expect(armyRelicReward(store, action.army, { resourceType: ResourcesIds.Wheat, amount: 100n }, 350)).toEqual({
    resourceType: ResourcesIds.Wheat,
    amount: 100n,
  });
  const rift = campBeside("Rift");
  rift.store.applyFacts([relicEffectFact("Plunder")]);
  expect(readSiteCard(rift.store, rift.site, rift.structure, SITE_TILE, rift.attack(action.armyTile)).payout).toEqual({
    resourceId: ResourcesIds.Essence,
    amount: 5940,
    fits: 5940,
  });
});

it("keeps the forecast and eligible rewards unknown until missing effects are known absent", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(store, site, structure, SITE_TILE, action)).toMatchObject({
    fight: undefined,
    payout: undefined,
  });
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(store, site, structure, SITE_TILE, action)).toMatchObject({
    fight: { troopsLost: 457, guardLeft: 478 },
    payout: { amount: 825 },
  });
});

it("applies active relics to a slot army without modifying stored troop boosts", () => {
  const { store, attack } = campBeside();
  const { army } = attack({ col: 41, row: 12, alt: false });
  const slotKeys = {
    game_id: 1,
    structure_id: army.owner,
    epoch: BigInt(store.subscriptionScope().known!.expedition!.day),
    slot: 0,
  };
  const slotArmy = { ...army, troops: { ...army.troops, stamina: { Slot: 0 } } };
  store.applyFacts([
    { model: "ExplorerTroops", key: store.wireKeyOf("ExplorerTroops", army)!, value: slotArmy },
    {
      model: "ArmySlot",
      key: store.wireKeyOf("ArmySlot", slotKeys)!,
      value: {
        ...slotKeys,
        explorer_id: army.explorer_id,
        stamina: { amount: 100n, settled_at: 350n, remainder: 0 },
      },
    },
    {
      model: "ArmyProgress",
      key: "0x9101",
      value: {
        game_id: 1,
        explorer_id: army.explorer_id,
        logistics: 0,
      },
    },
    relicEffectFact("Blade"),
    relicEffectFact("Ward"),
  ]);
  const current = store.require("ExplorerTroops", army);
  expect(resolveExplorerCombatTroops(store, current, 379)?.boosts).toMatchObject({
    incr_damage_dealt_percent_num: 1000,
    decr_damage_gotten_percent_num: 500,
  });
  expect(resolveExplorerCombatTroops(store, current, 380)?.boosts).toMatchObject({
    incr_damage_dealt_percent_num: 0,
    decr_damage_gotten_percent_num: 0,
  });
  expect(current.troops.boosts.incr_damage_dealt_percent_num).toBe(0);
});

it("keeps the exact forecast through a last-target update and a fresh snapshot", () => {
  const { store, site, structure, attack } = campBeside();
  const key = { game_id: 1, explorer_id: 201n };
  const combat = store.require("ArmyCombat", key);
  const wireKey = store.wireKeyOf("ArmyCombat", key)!;
  const army = attack({ col: 41, row: 12, alt: false });
  store.applyFacts([{ model: "ArmyCombat", key: wireKey, value: { ...combat, last_target: 0n } }]);
  expect(readSiteCard(store, site, structure, SITE_TILE, army).fight).toEqual({ troopsLost: 457, guardLeft: 478 });
  store.applyFacts([{ model: "ArmyCombat", key: wireKey, value: { ...combat, last_target: site.entity_id } }]);
  expect(readSiteCard(store, site, structure, SITE_TILE, army).fight).toEqual({ troopsLost: 457, guardLeft: 478 });
  const restored = reloadSiteFacts(store);
  restored.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(restored, site, structure, SITE_TILE, army).fight).toEqual({ troopsLost: 457, guardLeft: 478 });
});

it("uses the same exact exchange for a replacement Deep guard and a site beast", () => {
  const { store, startsAt } = deepBattleTargetScenario();
  setBlockTimestampSource(() => startsAt);
  const key = { game_id: 1, explorer_id: 201n };
  const army = store.require("ExplorerTroops", key);
  const position = store.entityOccupancy(1, 201)!;
  const attack = {
    army,
    armyTile: { col: position.col, row: position.row, alt: position.alt },
    biome: BiomeType.Underground,
    timestamp: startsAt,
  };
  const combat = store.require("ArmyCombat", key);
  const combatKey = store.wireKeyOf("ArmyCombat", key)!;
  const quarry = () => readDeepSites(store, startsAt, 1).find(({ name }) => name === "Quarry")!;
  store.applyFacts([{ model: "ArmyCombat", key: combatKey, value: { ...combat, last_target: 301n } }]);
  expect(readDeepSiteFight(store, quarry(), attack)?.result).toEqual({ troopsLost: 437, guardLeft: 563 });
  const oldGuard = { game_id: 1, explorer_id: 301n };
  for (const [index, model] of (
    ["ExplorerTroops", "DeepArmy", "ArmyDay", "ArmyCombat", "DeepGuard"] as const
  ).entries()) {
    const row = store.require(model, oldGuard);
    store.applyFacts([{ model, key: `0xeef${index}`, value: { ...row, explorer_id: 302n } }]);
  }
  store.applyFacts([{ model: "DeepGuard", key: store.wireKeyOf("DeepGuard", oldGuard)!, value: null }]);
  expect(readDeepSiteFight(store, quarry(), attack)?.result).toEqual({ troopsLost: 437, guardLeft: 563 });
  store.applyFacts([
    { model: "DeepGuard", key: store.wireKeyOf("DeepGuard", { game_id: 1, explorer_id: 302n })!, value: null },
  ]);
  const site = quarry();
  store.applyFacts([
    { model: "Guard", key: store.wireKeyOf("Guard", site.guard!)!, value: { ...site.guard!, troops: army.troops } },
  ]);
  expect(readDeepSiteFight(store, quarry(), attack)?.result).toEqual({ troopsLost: 437, guardLeft: 563 });
  store.applyFacts([{ model: "ArmyCombat", key: combatKey, value: { ...combat, last_target: site.id } }]);
  expect(readDeepSiteFight(store, quarry(), attack)?.result).toEqual({ troopsLost: 437, guardLeft: 563 });
  store.applyFacts([{ model: "ArmyCombat", key: combatKey, value: null }]);
  expect(readDeepSiteFight(store, quarry(), attack)?.result).toEqual({ troopsLost: 437, guardLeft: 563 });
});
