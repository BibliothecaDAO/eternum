import { afterEach, expect, it } from "vitest";
import { getGuardsByStructure, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { nativeBaneConstants, nativeRaceConstants, readSiteReward } from "@bibliothecadao/eternum/game-client";
import { raceRules } from "@/lab/game/race-scenario";
import { readPlateReward } from "@/three/map-plates/plate-reward";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { campBeside, relicEffectFact, SITE, SITE_TILE } from "./site-fixture";
import { readSiteCard } from "./site-card-plan";
import { readClearedSite } from "./site-receipt";

const ENTITY = (7n << 32n) + 710n;
afterEach(() => setBlockTimestampSource(null));

function effectSite(blood: boolean, pale: boolean, spoils = false) {
  const fixture = campBeside();
  const { store } = fixture;
  const guard = store.require("Guard", { game_id: 1, structure_id: SITE, slot: 0 });
  store.applyFacts([
    { model: "ExpeditionSite", key: "0x72", value: { ...fixture.site, entity_id: ENTITY } },
    { model: "Structure", key: "0x71", value: { ...fixture.structure, entity_id: ENTITY } },
    { model: "Guard", key: "0x73", value: { ...guard, structure_id: ENTITY } },
    { model: "RaceRules", key: "0xa001", value: raceRules() },
    { model: "HomeAspect", key: "0xa002", value: { game_id: 1, home: 7n, aspect: 1 } },
    { model: "BaneRules", key: "0xa003", value: { game_id: 1, chance_step: 20, quorum_percent: 25,
      beast_percent: 150, stamina_percent: 50, production_percent: 50,
      quest_counts: [1,2,3,4,2,4,6,8,1,2,3,4] } },
    { model: "WorldBane", key: "0xa004", value: { game_id: 1, day: 1n, kind: blood ? nativeBaneConstants.BLOOD_MOON : 0 } },
    { model: "AspectActivity", key: "0xa005", value: { game_id: 1, aspect: 1, day: 0n, active: 4 } },
    ...(pale ? [{ model: "TriumphDay", key: "0xa006", value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.PALE_MOON_STAGE, day: 1n } }] : []),
    ...(spoils ? [{ model: "TriumphDay", key: "0xa007", value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.SPOILS_STAGE, day: 1n } }] : []),
  ] as never);
  setBlockTimestampSource(() => 450);
  return { ...fixture,
    site: store.require("ExpeditionSite", { game_id: 1, entity_id: ENTITY }),
    structure: store.require("Structure", { game_id: 1, entity_id: ENTITY }),
  };
}

it.each([[true,false,1650],[false,true,550],[true,true,825]] as const)(
  "shares Blood Moon %s and Pale Moon %s strength between guards and the card", (blood,pale,count) => {
    const { store, site, structure } = effectSite(blood,pale);
    expect(getGuardsByStructure(structure, store)?.[0].troops.count).toBe(BigInt(count) * 1_000_000_000n);
    expect(readSiteCard(store, site, structure, SITE_TILE, null).guard?.count).toBe(count);
    expect(store.require("Guard", { game_id: 1, structure_id: ENTITY, slot: 0 }).troops.count).toBe(1_100_000_000_000n);
  },
);

it("stops Blood Moon at the recorded quorum while preserving Pale Moon and base losses", () => {
  const { store, site, structure } = effectSite(true,true);
  const guard = store.require("Guard", { game_id: 1, structure_id: ENTITY, slot: 0 });
  store.applyFacts([
    { model: "Guard", key: "0x73", value: { ...guard, troops: { ...guard.troops, count: 800_000_000_000n } } },
    { model: "BaneProgress", key: "0xa008", value: { game_id: 1, aspect: 1, day: 1n, completed: 1, ended_at: 460n } },
  ]);
  expect(readSiteCard(store,site,structure,SITE_TILE,null).guard?.count).toBe(600);
  setBlockTimestampSource(() => 460);
  expect(readSiteCard(store,site,structure,SITE_TILE,null).guard?.count).toBe(400);
});

it("uses Spoils for the card and map reward, but a receipt keeps its exact earned XP", () => {
  const { store, site, structure } = effectSite(false,false,true);
  expect(readSiteCard(store,site,structure,SITE_TILE,null)).toMatchObject({ xp: 246,
    payout: { resourceId: ResourcesIds.Labor, amount: 1650, fits: 1650 } });
  expect(readPlateReward(store, { entityId: Number(ENTITY), structureType: StructureType.Camp, mineKind: undefined }))
    .toEqual({ amount: 1650, unit: "Labor" });
  store.applyFacts([{ model: "ExpeditionSite", key: "0x72", value: { ...site,
    clear: { explorer_id: 201n, home_id: 7n, reward: null, xp: 344 } } }]);
  setBlockTimestampSource(() => 950);
  expect(readClearedSite(store,1,SITE_TILE)?.xp).toBe(344);
});

it("leaves the Deep unchanged and refuses unknown effect facts", () => {
  const { store, site, structure } = effectSite(true,true,true);
  const deep = { ...site, row: 32 };
  store.applyFacts([{ model: "ExpeditionSite", key: "0x72", value: deep }]);
  expect(getGuardsByStructure(structure,store)?.[0].troops.count).toBe(1_100_000_000_000n);
  expect(readSiteReward(store,deep).known?.xp).toBe(205);
  store.applyFacts([{ model: "ExpeditionSite", key: "0x72", value: site },
    { model: "HomeAspect", key: "0xa002", value: null }]);
  expect(readSiteReward(store,site).known).toBeUndefined();
  expect(getGuardsByStructure(structure,store)).toBeUndefined();
});

it("composes Spoils with Plunder and Tome at the selected attack second", () => {
  const { store, site, structure, attack } = effectSite(false,false,true);
  const action = { ...attack({ col: 41, row: 12, alt: false }), timestamp: 450 };
  store.applyFacts([relicEffectFact("Plunder",1,500), relicEffectFact("Tome",1,500)]);
  expect(readSiteCard(store,site,structure,SITE_TILE,action)).toMatchObject({
    xp: 344, payout: { amount: 1980, fits: 1980 },
  });
  expect(readSiteCard(store,site,structure,SITE_TILE,{ ...action, timestamp: 500 })).toMatchObject({
    xp: 246, payout: { amount: 1650, fits: 1650 },
  });
});
