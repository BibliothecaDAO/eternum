import oathDamage from "../../../../../../../contracts/l3/world-native/tests/fixtures/oath-damage.txt?raw";
import { deepBattleTargetScenario } from "@/lab/game/battle-target-scenario";
import {
  nativeOathConstants as oaths,
  nativeRuleConstants,
  nativeStructureConstants,
  readDeepSites,
} from "@bibliothecadao/eternum/game-client";
import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";
import { afterEach, describe, expect, it } from "vitest";
import { armyRelicReward, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";
import { readDeepSiteFight, readArmyCard, readSiteCard } from "./site-card-plan";
import {
  blightglowRift,
  campBeside as campOffMap,
  otherArmyAt,
  placeSite,
  relicEffectFact,
  reloadSiteFacts,
} from "./site-fixture";

const campBeside = (...args: Parameters<typeof campOffMap>) => {
  const fixture = campOffMap(...args);
  placeSite(fixture.store);
  return fixture;
};

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's tile card", () => {
  it("shows a camp's guard as troops and tier, its labor payout, and the exact fight from the army beside it", () => {
    const { store, site, structure, attack } = campBeside();
    const plan = readSiteCard(store, site, structure, attack({ col: 41, row: 12, alt: false }));
    expect(plan.name).toBe("Golem");
    expect(plan.beast?.beast).toBe("troll");
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_100 });
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 825, fits: 825 });
    expect(plan.attackStamina).toBe(release.definition.rules.troop_stamina_config.stamina_attack_req);
    // The one attack Attack sends now, as the contract resolves it and its result will show it: this attack's losses
    // and the guard it leaves standing (a second attack would clear the camp; the card speaks of none but this one).
    expect(plan.fight).toEqual({ troopsLost: 457, guardLeft: 478 });
  });

  it("refuses the attack of an army short of its stamina as the contract does, with no figures of a later fight", () => {
    const { store, site, structure, attack } = campBeside("Camp", true, 0n);
    const plan = readSiteCard(store, site, structure, attack({ col: 41, row: 12, alt: false }));
    expect(plan.fight).toEqual({ refused: true });
    expect(plan.attackStamina).toBe(release.definition.rules.troop_stamina_config.stamina_attack_req);
  });

  it("forecasts an army out of reach as it would attack from beside the site, and none with no army selected", () => {
    const { store, site, structure, attack } = campBeside();
    const beside = readSiteCard(store, site, structure, attack({ col: 41, row: 12, alt: false }));
    const far = readSiteCard(store, site, structure, attack({ col: 44, row: 12, alt: false }));
    expect(beside.inReach).toBe(true);
    expect(far.inReach).toBe(false);
    // The same army, stamina and biome: the attack its Move leads to is the one beside the site.
    expect(far.fight).toEqual({ troopsLost: 457, guardLeft: 478 });
    const armyless = readSiteCard(store, site, structure, null);
    expect(armyless.fight).toBeUndefined();
    expect(armyless.inReach).toBe(false);
  });

  it("distinguishes an unknown guard from an empty slot after the snapshot completes", () => {
    const { store, site, structure, attack } = campBeside("Camp", false);
    const army = attack({ col: 41, row: 12, alt: false });
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
    expect(readSiteCard(store, site, structure, army)).toMatchObject({
      guard: undefined,
      fight: undefined,
    });
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
    expect(readSiteCard(store, site, structure, army)).toMatchObject({
      guard: null,
      fight: undefined,
    });
  });

  it("names a ruin by the beast its depth calls for, and pays no resource", () => {
    setBlockTimestampSource(() => 350);
    const { store, site, structure } = campBeside("Ruin");
    const plan = readSiteCard(store, site, structure, null);
    expect(plan.name).toBe("Ammit");
    expect(plan.payout).toBeNull();
    expect(plan.ruinDepth).toBe("Veil");
    const rift = campBeside("Rift");
    expect(readSiteCard(rift.store, rift.site, rift.structure, null).payout).toEqual({
      resourceId: ResourcesIds.Essence,
      amount: 4_950,
      fits: 4_950,
    });
  });
});

it("shows only the camp reward that fits in the home labor store", () => {
  const { store, site, structure, attack } = campBeside();
  const home = attack({ col: 41, row: 12, alt: false }).army.owner;
  const limit = BigInt(nativeStructureConstants.LABOR_STORES[0]!) * 1_000_000_000n;
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
  const plan = readSiteCard(store, site, structure, attack({ col: 41, row: 12, alt: false }));
  expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 825, fits: 10 });
});

it("refuses another player's army outside the Deep, near or far, as the contract does, and shows its troops", () => {
  const { store, attack } = campBeside();
  const other = otherArmyAt(store, 42, 12);
  const plan = readArmyCard(store, other, attack({ col: 41, row: 12, alt: false }));
  expect(plan.kind).toBe("Army");
  expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 300 });
  expect(plan.payout).toBeNull();
  expect(plan).toMatchObject({ fight: { refused: true }, blocked: "outside-deep", inReach: true });
  expect(readArmyCard(store, other, attack({ col: 44, row: 12, alt: false }))).toMatchObject({
    fight: { refused: true },
    blocked: "outside-deep",
  });
});

it("says a stronger band holds an Oath, as the contract offers a pick on its clear, and a lowly herd none", () => {
  const { store, site, structure, attack } = campBeside("Beasts");
  const own = attack({ col: 41, row: 12, alt: false });
  const { spacing } = store.require("SettlementRules", { game_id: 1 });
  const bounds = store.require("DepthRules", { game_id: 1, depth: Math.floor(site.row / spacing) % 4 });
  const withGuards = (count: number) => ({ ...site, initial_guard_count: BigInt(count) * 1_000_000_000n });
  expect(readSiteCard(store, withGuards(bounds.beast_strong_lower), structure, own).holdsOath).toBe(true);
  expect(readSiteCard(store, withGuards(bounds.beast_weak_upper), structure, own).holdsOath).toBe(false);
});

it("shows a herd's wheat from initial guards as its resource payout", () => {
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
  const plan = readSiteCard(store, site, structure, own);
  expect(plan.payout).toEqual({ resourceId: ResourcesIds.Wheat, amount: 6000, fits: 10 });
});

describe("the recorded Blightglow Rift under Frontier's current combat rules", () => {
  const card = (troops: bigint, guardStamina: bigint, armyStamina = 100n) => {
    const { store, site, structure, attack } = blightglowRift({ troops, guardStamina, armyStamina });
    return readSiteCard(store, site, structure, attack({ col: 41, row: 12, alt: false }));
  };

  it("forecasts the rested guard with the same formula as a field army", () => {
    const plan = card(794n, 120n);
    expect(plan.guard).toEqual({ type: TroopType.Crossbowman, tier: TroopTier.T1, count: 1_400 });
    expect(plan.attackStamina).toBe(30);
    expect(plan.firstStrike).toBe("defender");
    expect(plan.fight).toEqual({ troopsLost: 451, guardLeft: 1_253 });
  });

  it("keeps the guard's damage at full strength below its defense stamina cost", () => {
    expect(card(793n, 39n).fight).toEqual({ troopsLost: 451, guardLeft: 1_253 });
  });

  it("refuses the attack of an army below the attack's stamina, as the contract does", () => {
    const refused = card(794n, 120n, 29n);
    expect(refused.fight).toEqual({ refused: true });
    expect(refused.firstStrike).toBe("defender");
    expect(card(794n, 120n, 30n).fight).toEqual({ troopsLost: 451, guardLeft: 1_253 });
  });
});

it("forecasts Blade, Ward and Plunder at the attack second and drops them exactly at expiry", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  const read = (timestamp: number) => readSiteCard(store, site, structure, { ...action, timestamp });
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
  const limit = BigInt(nativeStructureConstants.LABOR_STORES[0]!) * 1_000_000_000n;
  const keys = { game_id: 1, entity_id: action.army.owner, resource_type: ResourcesIds.Labor };
  store.applyFacts([
    relicEffectFact("Plunder"),
    { model: "ResourceBalance", key: "0x79", value: { ...keys, balance: limit - 900n * 1_000_000_000n } },
  ]);
  expect(readSiteCard(store, site, structure, action).payout).toEqual({
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
  expect(
    readSiteCard(rift.store, rift.site, rift.structure, rift.attack({ col: 41, row: 12, alt: false })).payout,
  ).toEqual({
    resourceId: ResourcesIds.Essence,
    amount: 5940,
    fits: 5940,
  });
});

it("pays Rage's share more on a camp the attacker clears, before Plunder, and nothing on a ruin", () => {
  const holdRage = (store: ReturnType<typeof campBeside>["store"]) => {
    const key = { game_id: 1, explorer_id: 201n };
    const progress = store.require("ArmyProgress", key);
    store.applyFacts([
      {
        model: "ArmyProgress",
        key: store.wireKeyOf("ArmyProgress", key)!,
        value: { ...progress, oaths: 1 << (oaths.RAGE - 1) },
      },
    ]);
  };
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  holdRage(store);
  expect(readSiteCard(store, site, structure, action).payout).toMatchObject({
    resourceId: ResourcesIds.Labor,
    amount: 1_031.25,
  });
  store.applyFacts([relicEffectFact("Plunder")]);
  expect(readSiteCard(store, site, structure, action).payout).toMatchObject({ amount: 1_237.5 });
  const ruin = campBeside("Ruin");
  holdRage(ruin.store);
  expect(
    readSiteCard(ruin.store, ruin.site, ruin.structure, ruin.attack({ col: 41, row: 12, alt: false })).payout,
  ).toBeNull();
});

it("pays Perfection's share more only when the attack clears the camp with under its loss line lost", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  const armyKey = { game_id: 1, explorer_id: 201n };
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", armyKey)!,
      value: { ...store.require("ArmyProgress", armyKey), oaths: 1 << (oaths.PERFECTION - 1) },
    },
  ]);
  expect(readSiteCard(store, site, structure, action)).toMatchObject({
    fight: { troopsLost: 457, guardLeft: 478 },
    payout: { amount: 825 },
  });
  const guardKey = { game_id: 1, structure_id: structure.entity_id, slot: 0 };
  const guard = store.require("Guard", guardKey);
  store.applyFacts([
    {
      model: "Guard",
      key: store.wireKeyOf("Guard", guardKey)!,
      value: { ...guard, troops: { ...guard.troops, count: 10n * 1_000_000_000n } },
    },
  ]);
  expect(readSiteCard(store, site, structure, action)).toMatchObject({
    fight: { guardLeft: 0 },
    payout: { amount: 1_237.5 },
  });
});

it("keeps the forecast and eligible rewards unknown until missing effects are known absent", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(store, site, structure, action)).toMatchObject({
    fight: undefined,
    payout: undefined,
  });
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(store, site, structure, action)).toMatchObject({
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
  expect(readSiteCard(store, site, structure, army).fight).toEqual({ troopsLost: 457, guardLeft: 478 });
  store.applyFacts([{ model: "ArmyCombat", key: wireKey, value: { ...combat, last_target: site.entity_id } }]);
  expect(readSiteCard(store, site, structure, army).fight).toEqual({ troopsLost: 457, guardLeft: 478 });
  const restored = reloadSiteFacts(store);
  restored.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(restored, site, structure, army).fight).toEqual({ troopsLost: 457, guardLeft: 478 });
});

it("keeps a replacement Knight guard protected and removes that protection from the beast", () => {
  const { store, startsAt } = deepBattleTargetScenario();
  setBlockTimestampSource(() => startsAt);
  const key = { game_id: 1, explorer_id: 201n };
  const army = store.require("ExplorerTroops", key);
  const attack = { army, timestamp: startsAt };
  const combat = store.require("ArmyCombat", key);
  const combatKey = store.wireKeyOf("ArmyCombat", key)!;
  const mine = () => readDeepSites(store, startsAt, 1).find(({ kind }) => kind === nativeRuleConstants.DEEP_MINE)!;
  store.applyFacts([{ model: "ArmyCombat", key: combatKey, value: { ...combat, last_target: 301n } }]);
  expect(readDeepSiteFight(store, mine(), attack)?.result).toEqual({ troopsLost: 330, guardLeft: 754 });
  const oldGuard = { game_id: 1, explorer_id: 301n };
  for (const [index, model] of (
    ["ExplorerTroops", "DeepArmy", "ArmyDay", "ArmyCombat", "ArmyProgress", "DeepGuard"] as const
  ).entries()) {
    const row = store.require(model, oldGuard);
    store.applyFacts([{ model, key: `0xeef${index}`, value: { ...row, explorer_id: 302n } }]);
  }
  store.applyFacts([{ model: "DeepGuard", key: store.wireKeyOf("DeepGuard", oldGuard)!, value: null }]);
  expect(readDeepSiteFight(store, mine(), attack)?.result).toEqual({ troopsLost: 330, guardLeft: 754 });
  store.applyFacts([
    { model: "DeepGuard", key: store.wireKeyOf("DeepGuard", { game_id: 1, explorer_id: 302n })!, value: null },
  ]);
  const site = mine();
  store.applyFacts([
    {
      model: "Guard",
      key: store.wireKeyOf("Guard", site.guard!)!,
      value: { ...site.guard!, troops: { ...army.troops, category: "Knight" } },
    },
  ]);
  expect(readDeepSiteFight(store, mine(), attack)?.result).toEqual({ troopsLost: 294, guardLeft: 672 });
  store.applyFacts([{ model: "ArmyCombat", key: combatKey, value: { ...combat, last_target: site.id } }]);
  expect(readDeepSiteFight(store, mine(), attack)?.result).toEqual({ troopsLost: 294, guardLeft: 672 });
  store.applyFacts([{ model: "ArmyCombat", key: combatKey, value: null }]);
  expect(readDeepSiteFight(store, mine(), attack)?.result).toEqual({ troopsLost: 294, guardLeft: 672 });
});

it("previews both armies' held damage Oaths from synchronized facts and refuses missing progress", () => {
  const { store, startsAt } = deepBattleTargetScenario(true);
  setBlockTimestampSource(() => startsAt);
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201n });
  const attack = { army, timestamp: startsAt };
  const site = readDeepSites(store, startsAt, 1).find(({ kind }) => kind === nativeRuleConstants.DEEP_MINE)!;
  const fields = oathDamage.trim().split(/\s+/).map(Number);
  const [before, , after, guardAfter] = fields.slice(26, 30);
  expect(readDeepSiteFight(store, site, attack)?.result).toEqual({
    troopsLost: before! - after!,
    guardLeft: guardAfter,
  });
  const guard = site.guards[0]!.army;
  const progress = store.require("ArmyProgress", guard);
  const key = store.wireKeyOf("ArmyProgress", guard)!;
  store.applyFacts([{ model: "ArmyProgress", key, value: { ...progress, oaths: 0 } }]);
  expect(readDeepSiteFight(store, site, attack)?.result).toEqual({
    troopsLost: 262,
    guardLeft: 705,
  });
  store.applyFacts([{ model: "ArmyProgress", key, value: null }]);
  expect(() => readDeepSiteFight(store, site, attack)).toThrow("Deep attrition requires its rules and army progress");
});
