import { afterEach, describe, expect, it } from "vitest";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { readSiteCard } from "./site-card-plan";
import { campBeside, SITE_TILE } from "./site-fixture";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's tile card", () => {
  it("shows a camp's guard as troops and tier, its labor payout, and the exact fight from the army beside it", () => {
    const { store, site, structure, attack } = campBeside();
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    expect(plan.name).toBe("Camp");
    expect(plan.art).toBe("/images/buildings/construction/camp.png");
    expect(plan.guard).toEqual({ type: TroopType.Knight, tier: TroopTier.T1, count: 1_100 });
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Labor, amount: 550 });
    expect(plan.attackStamina).toBe(preset.rules.troop_stamina_config.stamina_attack_req);
    expect(plan.fight).toMatchObject({ outcome: "wins" });
    const fight = plan.fight as { exchanges: number; troopsLost: number };
    expect(fight.exchanges).toBeGreaterThan(0);
    expect(fight.troopsLost).toBeGreaterThan(0);
    expect(fight.troopsLost).toBeLessThan(1_498);
  });

  it("has no fight for an army out of reach or none selected, and an unknown guard until its slots arrive", () => {
    const { store, site, structure, attack } = campBeside();
    expect(
      readSiteCard(store, site, structure, SITE_TILE, attack({ col: 44, row: 12, alt: false })).fight,
    ).toBeUndefined();
    expect(readSiteCard(store, site, structure, SITE_TILE, null).fight).toBeUndefined();
    const unknown = campBeside("Camp", false);
    const plan = readSiteCard(unknown.store, unknown.site, unknown.structure, SITE_TILE, null);
    expect(plan.guard).toBeUndefined();
  });

  it("names a fallen realm by the beast its depth calls for, and pays its chest", () => {
    const { store, site, structure } = campBeside("FallenRealm");
    // Row 12 of ten-row bands is the second band: Ethereal I, held by a wyvern.
    const plan = readSiteCard(store, site, structure, SITE_TILE, null);
    expect(plan.name).toBe("Wyvern");
    expect(plan.payout).toBeNull();
    const rift = campBeside("Rift");
    expect(readSiteCard(rift.store, rift.site, rift.structure, SITE_TILE, null).payout).toEqual({
      resourceId: ResourcesIds.Essence,
      amount: 3_300,
    });
  });
});
