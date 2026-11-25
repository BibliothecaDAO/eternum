import { afterEach, expect, it } from "vitest";
import {
  dayAtIndex,
  getGuardsByStructure,
  readExpeditionRules,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import {
  nativeBaneConstants,
  nativeRaceConstants,
  readSiteEffects,
  readSiteReward,
} from "@bibliothecadao/eternum/game-client";
import { raceRules } from "@/lab/game/race-scenario";
import { readPlateReward } from "@/three/map-plates/plate-reward";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { gameRegistryRow } from "../../../../../../../packages/core/src/test-support/game-registry";
import { frontierSeasonOnePreset } from "../../../../../../../config/source/frontier/season-one";
import { campBeside, relicEffectFact, SITE_TILE } from "./site-fixture";
import { readSiteCard } from "./site-card-plan";
import { readClearedSite } from "./site-receipt";

const ENTITY = (7n << 32n) + 710n;
const BANE_DAY = frontierSeasonOnePreset.banes.quietDays;
afterEach(() => setBlockTimestampSource(null));

function effectSite(blood: boolean, pale: boolean, spoils = false) {
  const fixture = campBeside("Camp", true, 100n, ENTITY);
  const { store } = fixture;
  store.applyFacts([
    { model: "GameRegistry", key: "0x3", value: gameRegistryRow({ end_at: "10000", scheduled_end_at: "10000" }) },
  ] as never);
  const at = dayAtIndex(readExpeditionRules(store, 1)!, BANE_DAY).start + 50;
  store.applyFacts([
    { model: "RaceRules", key: "0xa001", value: raceRules() },
    { model: "HomeAspect", key: "0xa002", value: { game_id: 1, home: 7n, aspect: 1 } },
    {
      model: "BaneRules",
      key: "0xa003",
      value: {
        game_id: 1,
        chance_step: frontierSeasonOnePreset.banes.chanceStep,
        quorum_percent: 25,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [1, 2, 3, 4, 2, 4, 6, 8, 1, 2, 3, 4],
      },
    },
    {
      model: "WorldBane",
      key: "0xa004",
      value: { game_id: 1, day: BigInt(BANE_DAY), kind: blood ? nativeBaneConstants.BLOOD_MOON : 0 },
    },
    { model: "AspectActivity", key: "0xa005", value: { game_id: 1, aspect: 1, day: BigInt(BANE_DAY - 1), active: 4 } },
    ...(pale
      ? [
          {
            model: "TriumphDay",
            key: "0xa006",
            value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.PALE_MOON_STAGE, day: BigInt(BANE_DAY) },
          },
        ]
      : []),
    ...(spoils
      ? [
          {
            model: "TriumphDay",
            key: "0xa007",
            value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.SPOILS_STAGE, day: BigInt(BANE_DAY) },
          },
        ]
      : []),
  ] as never);
  setBlockTimestampSource(() => at);
  return {
    ...fixture,
    at,
    site: store.require("ExpeditionSite", { game_id: 1, entity_id: ENTITY }),
    structure: store.require("Structure", { game_id: 1, entity_id: ENTITY }),
  };
}

it.each([
  [true, false, 1650],
  [false, true, 550],
  [true, true, 825],
] as const)("shares Blood Moon %s and Pale Moon %s strength between guards and the card", (blood, pale, count) => {
  const { store, site, structure } = effectSite(blood, pale);
  expect(getGuardsByStructure(structure, store)?.[0].troops.count).toBe(BigInt(count) * 1_000_000_000n);
  expect(readSiteCard(store, site, structure, null).guard?.count).toBe(count);
  expect(store.require("Guard", { game_id: 1, structure_id: ENTITY, slot: 0 }).troops.count).toBe(1_100_000_000_000n);
});

it("resolves effects through the actual realm ID inside a home namespace", () => {
  const { store, site, structure } = effectSite(true, true, true);
  const home = store.require("Structure", { game_id: 1, entity_id: 7n });
  const homeKey = store.wireKeyOf("Structure", { game_id: 1, entity_id: 7n })!;
  const actualHome = (7n << 32n) + 1n;
  store.applyFacts([
    { model: "Structure", key: homeKey, value: null },
    { model: "HomeAspect", key: "0xa002", value: null },
    { model: "Structure", key: "0xb001", value: { ...home, entity_id: actualHome } },
    { model: "HomeAspect", key: "0xb002", value: { game_id: 1, home: actualHome, aspect: 1 } },
  ]);
  expect(readSiteEffects(store, site)).toEqual({ known: { beastBps: 7500, spoilsPercent: 200 } });
  expect(getGuardsByStructure(structure, store)?.[0].troops.count).toBe(825_000_000_000n);
  expect(readSiteReward(store, site).known).toMatchObject({ reward: { amount: 1_650_000_000_000n } });
});

it("stops Blood Moon at the recorded quorum while preserving Pale Moon and base losses", () => {
  const { store, site, structure, at } = effectSite(true, true);
  const guard = store.require("Guard", { game_id: 1, structure_id: ENTITY, slot: 0 });
  store.applyFacts([
    { model: "Guard", key: "0x73", value: { ...guard, troops: { ...guard.troops, count: 800_000_000_000n } } },
    {
      model: "BaneProgress",
      key: "0xa008",
      value: { game_id: 1, aspect: 1, day: BigInt(BANE_DAY), completed: 1, ended_at: BigInt(at + 10) },
    },
  ]);
  expect(readSiteCard(store, site, structure, null).guard?.count).toBe(600);
  setBlockTimestampSource(() => at + 10);
  expect(readSiteCard(store, site, structure, null).guard?.count).toBe(400);
});

it("uses Spoils for the preview while receipts retain the exact credited reward", () => {
  const { store, site, structure } = effectSite(false, false, true);
  expect(readSiteCard(store, site, structure, null)).toMatchObject({
    payout: { resourceId: ResourcesIds.Labor, amount: 1650, fits: 1650 },
  });
  expect(
    readPlateReward(store, { entityId: Number(ENTITY), structureType: StructureType.Camp, mineKind: undefined }),
  ).toEqual({ amount: 1650, unit: "Labor" });
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: {
        ...site,
        clear: {
          explorer_id: 201n,
          home_id: 7n,
          reward: { resource_type: ResourcesIds.Labor, amount: 1_980_000_000_000n },
        },
      },
    },
  ]);
  setBlockTimestampSource(() => 950);
  expect(readClearedSite(store, 1, SITE_TILE)?.site.clear?.reward).toEqual({
    resource_type: ResourcesIds.Labor,
    amount: 1_980_000_000_000n,
  });
});

it("leaves the Deep unchanged and refuses unknown effect facts", () => {
  const { store, site, structure } = effectSite(true, true, true);
  const deep = { ...site, row: 32 };
  store.applyFacts([{ model: "ExpeditionSite", key: "0x72", value: deep }]);
  expect(getGuardsByStructure(structure, store)?.[0].troops.count).toBe(1_100_000_000_000n);
  expect(readSiteReward(store, deep).known?.reward).toEqual({
    resourceType: ResourcesIds.Labor,
    amount: 1_375_000_000_000n,
  });
  store.applyFacts([
    { model: "ExpeditionSite", key: "0x72", value: site },
    { model: "HomeAspect", key: "0xa002", value: null },
  ]);
  expect(readSiteReward(store, site).known).toBeUndefined();
  expect(getGuardsByStructure(structure, store)).toBeUndefined();
});

it("composes Spoils with Plunder at the selected attack second", () => {
  const { store, site, structure, attack, at } = effectSite(false, false, true);
  const action = { ...attack({ col: 41, row: 12, alt: false }), timestamp: at };
  store.applyFacts([relicEffectFact("Plunder", 1, at + 50)]);
  expect(readSiteCard(store, site, structure, action)).toMatchObject({
    payout: { amount: 1980, fits: 1980 },
  });
  expect(readSiteCard(store, site, structure, { ...action, timestamp: at + 50 })).toMatchObject({
    payout: { amount: 1650, fits: 1650 },
  });
});
