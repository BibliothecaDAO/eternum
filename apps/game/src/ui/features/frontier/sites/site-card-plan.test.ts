import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";
import { afterEach, describe, expect, it } from "vitest";
import { armyRelicReward, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { readArmyCard, readSiteCard } from "./site-card-plan";
import { blightglowRift, campBeside, otherArmyAt, relicEffectFact, SITE_TILE } from "./site-fixture";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's tile card", () => {
  it("shows a camp's guard as troops and tier, its labor payout, and the exact fight from the army beside it", () => {
    const { store, site, structure, attack } = campBeside();
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    expect(plan.name).toBe("Troll");
    expect(plan.beast?.beast).toBe("troll");
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_100 });
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 825, fits: 825 });
    expect(plan.xp).toBe(123);
    expect(plan.attackStamina).toBe(preset.rules.troop_stamina_config.stamina_attack_req);
    // The one attack Attack sends now, as the contract resolves it and its result will show it: this attack's losses
    // and the guard it leaves standing (a second attack would clear the camp; the card speaks of none but this one).
    expect(plan.fight).toEqual({ troopsLost: 320, guardLeft: 492 });
  });

  it("refuses the attack of an army short of its stamina as the contract does, with no figures of a later fight", () => {
    const { store, site, structure, attack } = campBeside("Camp", true, 0n);
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    // Sent now, the contract refuses it ("you have 0 stamina, but need …"). The card once counted the attack its
    // stamina would pay for later, against a guard rested by then (457 lost, not this moment's 320): figures no
    // Attack pressed now would bring (owner, 3 November 2026: "when you dont have enough stamina the fight calc is
    // incorrect").
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
    expect(far.fight).toEqual({ troopsLost: 320, guardLeft: 492 });
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
    expect(plan.xp).toBe(123);
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
  expect(plan.xp).toBeUndefined();
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

it("shows beast labor from initial guards and clips it at the home store, alongside clear XP", () => {
  const { store, site, structure, attack } = campBeside("Beasts");
  const own = attack({ col: 41, row: 12, alt: false });
  const limit = BigInt(store.require("BoardRules", { game_id: 1 }).settlement_resource_cap) * 1_000_000_000n;
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: "0x79",
      value: {
        game_id: 1,
        entity_id: own.army.owner,
        resource_type: ResourcesIds.Labor,
        balance: limit - 10_000_000_000n,
      },
    },
  ]);
  const plan = readSiteCard(store, site, structure, SITE_TILE, own);
  expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 375, fits: 10 });
  expect(plan.xp).toBe(118);
});

describe("prod's Blightglow Rift, read through the card's own facts on Frontier's deployed combat", () => {
  const card = (troops: bigint, guardStamina: bigint, armyStamina = 100n) => {
    const { store, site, structure, attack } = blightglowRift({ troops, guardStamina, armyStamina });
    return readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
  };

  it("forecasts a rested guard as the owner's first card read it: 794 → 193, 1,400 → 1,033", () => {
    const plan = card(794n, 120n);
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_400 });
    expect(plan.attackStamina).toBe(30);
    expect(plan.fight).toEqual({ troopsLost: 601, guardLeft: 1_033 });
  });

  it("forecasts the guard tired, short of its 40 defense stamina, as the second read it: 793 → 372, 1,400 → 1,034", () => {
    // A tired guard strikes at 70%: 421 lost where 601 would be; the army's own blow is unchanged.
    expect(card(793n, 39n).fight).toEqual({ troopsLost: 421, guardLeft: 1_034 });
  });

  it("refuses the attack of an army below the attack's stamina, as the contract does", () => {
    expect(card(794n, 120n, 29n).fight).toEqual({ refused: true });
    expect(card(794n, 120n, 30n).fight).toEqual({ troopsLost: 601, guardLeft: 1_033 });
  });
});


it("forecasts Blade and Ward, Plunder and Tome at the attack second and drops them exactly at expiry", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  const read = (timestamp: number) => readSiteCard(store, site, structure, SITE_TILE, { ...action, timestamp });
  expect(read(350)).toMatchObject({ fight: { troopsLost: 320, guardLeft: 492 }, xp: 123, payout: { amount: 825 } });
  store.applyFacts([relicEffectFact("Blade"), relicEffectFact("Ward"), relicEffectFact("Plunder"), relicEffectFact("Tome")]);
  expect(read(379)).toMatchObject({ fight: { troopsLost: 304, guardLeft: 431 }, xp: 172, payout: { amount: 990, fits: 990 } });
  expect(read(380)).toMatchObject({ fight: { troopsLost: 320, guardLeft: 492 }, xp: 123, payout: { amount: 825 } });
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
  expect(readSiteCard(store, site, structure, SITE_TILE, action).payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 990, fits: 900 });
  expect(armyRelicReward(store, action.army, { resourceType: ResourcesIds.Wheat, amount: 100n }, 350)).toEqual({ resourceType: ResourcesIds.Wheat, amount: 100n });
  const rift = campBeside("Rift");
  rift.store.applyFacts([relicEffectFact("Plunder")]);
  expect(readSiteCard(rift.store, rift.site, rift.structure, SITE_TILE, rift.attack(action.armyTile)).payout).toEqual({ resourceId: ResourcesIds.Essence, amount: 5940, fits: 5940 });
});

it("keeps the forecast and eligible rewards unknown until missing effects are known absent", () => {
  const { store, site, structure, attack } = campBeside();
  const action = attack({ col: 41, row: 12, alt: false });
  store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(store, site, structure, SITE_TILE, action)).toMatchObject({ fight: undefined, payout: undefined, xp: undefined });
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  expect(readSiteCard(store, site, structure, SITE_TILE, action)).toMatchObject({ fight: { troopsLost: 320, guardLeft: 492 }, xp: 123, payout: { amount: 825 } });
});


it("adds active relics to a slot army's Battle skill without modifying stored troop boosts", () => {
  const { store, attack } = campBeside();
  const { army } = attack({ col: 41, row: 12, alt: false });
  const slotArmy = { ...army, troops: { ...army.troops, stamina: { Slot: 0 } } };
  store.applyFacts([
    { model: "ExplorerTroops", key: store.wireKeyOf("ExplorerTroops", army)!, value: slotArmy },
    { model: "ArmySlot", key: "0x9100", value: {
      game_id: 1, structure_id: army.owner, epoch: BigInt(store.subscriptionScope().known!.expedition!.day), slot: 0,
      explorer_id: army.explorer_id, stamina: { amount: 100n, settled_at: 350n, remainder: 0 },
    } },
    { model: "ArmyProgress", key: "0x9101", value: {
      game_id: 1, explorer_id: army.explorer_id, xp: 0, battle: 3, logistics: 0, scouting: 0, scouting_kinds: 0, homecoming: 0,
      common_points: 0, uncommon_points: 0, rare_points: 0, epic_points: 0, legendary_points: 0,
    } },
    relicEffectFact("Blade"), relicEffectFact("Ward"),
  ]);
  const current = store.require("ExplorerTroops", army);
  expect(resolveExplorerCombatTroops(store, current, 379)?.boosts).toMatchObject({ incr_damage_dealt_percent_num: 5500, decr_damage_gotten_percent_num: 500 });
  expect(resolveExplorerCombatTroops(store, current, 380)?.boosts).toMatchObject({ incr_damage_dealt_percent_num: 4500, decr_damage_gotten_percent_num: 0 });
  expect(current.troops.boosts.incr_damage_dealt_percent_num).toBe(0);
});
