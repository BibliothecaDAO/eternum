import { afterEach, describe, expect, it } from "vitest";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { readArmyCard, readSiteCard } from "./site-card-plan";
import { campBeside, otherArmyAt, SITE_TILE } from "./site-fixture";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's tile card", () => {
  it("shows a camp's guard as troops and tier, its labor payout, and the exact fight from the army beside it", () => {
    const { store, site, structure, attack } = campBeside();
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    expect(plan.name).toBe("Camp");
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_100 });
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 550, fits: 550 });
    expect(plan.xp).toBe(82);
    expect(plan.attackStamina).toBe(preset.rules.troop_stamina_config.stamina_attack_req);
    // The fight takes two attacks. The figures are the one Attack sends now, as its result will show them: this
    // attack's losses and the guard it leaves standing, never the whole fight's total.
    expect(plan.fight).toEqual({ outcome: "wins", exchanges: 2, troopsLost: 320, guardLeft: 492 });
  });

  it("has no fight for an army out of reach or none selected", () => {
    const { store, site, structure, attack } = campBeside();
    expect(
      readSiteCard(store, site, structure, SITE_TILE, attack({ col: 44, row: 12, alt: false })).fight,
    ).toBeUndefined();
    expect(readSiteCard(store, site, structure, SITE_TILE, null).fight).toBeUndefined();
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
    const { store, site, structure } = campBeside("Ruin");
    // Row 12 of ten-row bands is the second band: Ethereal I, held by a wyvern.
    const plan = readSiteCard(store, site, structure, SITE_TILE, null);
    expect(plan.name).toBe("Wyvern");
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Lords, amount: 500, fits: 500 });
    expect(plan.chest).toEqual({ tier: 3, amount: 500 });
    expect(plan.xp).toBe(82);
    const rift = campBeside("Rift");
    expect(readSiteCard(rift.store, rift.site, rift.structure, SITE_TILE, null).payout).toEqual({
      resourceId: ResourcesIds.Essence,
      amount: 3_300,
      fits: 3_300,
    });
  });
});

it("shows only the camp reward that fits in the home labor store", () => {
  const { store, site, structure, attack } = campBeside();
  const home = attack({ col: 41, row: 12, alt: false }).army.owner;
  const limit =
    BigInt(store.require("SliceRules", { game_id: 1 }).troop_limit_config.settlement_deployment_cap) *
    BigInt(store.require("BoardRules", { game_id: 1 }).castle_store_deploys) *
    1_000_000_000n;
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
  expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 550, fits: 10 });
});

it("reads another player's army as a target: its troops, the same exact fight in reach, and nothing it pays", () => {
  const { store, attack } = campBeside();
  const other = otherArmyAt(store, 42, 12);
  const plan = readArmyCard(store, other, { col: 42, row: 12, alt: false }, attack({ col: 41, row: 12, alt: false }));
  expect(plan.kind).toBe("Army");
  expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 300 });
  expect(plan.payout).toBeNull();
  expect(plan.xp).toBeUndefined();
  expect(plan.fight).toMatchObject({ outcome: "wins", guardLeft: 0 });
  expect(
    readArmyCard(store, other, { col: 44, row: 12, alt: false }, attack({ col: 41, row: 12, alt: false })).fight,
  ).toBeUndefined();
});
