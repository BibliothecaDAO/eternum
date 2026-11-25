// @vitest-environment jsdom
import { expect, it } from "vitest";

const { dayOf, readExpeditionRules, ResourceManager } = await import("@bibliothecadao/eternum");
const { nativeBaneConstants } = await import("@bibliothecadao/eternum/game-client");
const { BuildingType, ResourcesIds } = await import("@bibliothecadao/types");
const { dayEndScenario } = await import("@/lab/game/day-end-scenario");
const { buildingsMake, storeMakerLines } = await import("./store-makers");
const { readBuildOptions } = await import("../build/build-options");
const { readRealmStore } = await import("../realm-stores");
const { storeRateText } = await import("../hud/status-strip");
const { formatStoreRate } = await import("../stores");

const realm = () => {
  const { store, startsAt } = dayEndScenario();
  return { store, row: store.require("Structure", { game_id: 1, entity_id: 7 }), now: startsAt };
};

const ashFallToday = (store: ReturnType<typeof realm>["store"], now: number) => {
  const day = dayOf(readExpeditionRules(store, 1)!, now)!.index;
  store.applyFacts([
    { model: "HomeAspect", key: "0xa01", value: { game_id: 1, home: 7, aspect: 2 } },
    { model: "AspectActivity", key: "0xa02", value: { game_id: 1, aspect: 2, day: day - 1, active: 5 } },
    {
      model: "BaneRules",
      key: "0xa03",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 40,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10_000, 15_000],
      },
    },
    { model: "WorldBane", key: "0xa04", value: { game_id: 1, day: day - 1, kind: 0 } },
    { model: "WorldBane", key: "0xa05", value: { game_id: 1, day, kind: nativeBaneConstants.ASH_FALL } },
    { model: "BaneProgress", key: "0xa06", value: { game_id: 1, aspect: 2, day, completed: 1, ended_at: 0 } },
  ] as never);
};

const surfaces = (bane: boolean, kind: "wheat" | "troops", category: number) => {
  const { store, row, now } = realm();
  if (bane) ashFallToday(store, now);
  const reading = readRealmStore(store, row, readExpeditionRules(store, 1)!, kind, { now });
  const build = readBuildOptions(store, row, false, now)!.find((option) => option.category === category)!;
  const standing = new ResourceManager(store, 7).current(kind === "wheat" ? ResourcesIds.Wheat : ResourcesIds.Knight)!
    .production!.building_count;
  return {
    realmCard: storeRateText({ ...reading, kind, flyTarget: kind }),
    buildingPanel: formatStoreRate(kind, buildingsMake(store, row, category, now)!.perSecond),
    buildTimesStanding: formatStoreRate(kind, ((build.effect as { perHour: number }).perHour * standing) / 3_600),
  };
};

it("gives the realm card, the building panel and Build one rate per store, cut alike while Ash Fall halves production", () => {
  expect(surfaces(false, "wheat", BuildingType.ResourceWheat)).toEqual({
    realmCard: "+19/min",
    buildingPanel: "+19/min",
    buildTimesStanding: "+19/min",
  });
  expect(surfaces(true, "wheat", BuildingType.ResourceWheat)).toEqual({
    realmCard: "+9.5/min",
    buildingPanel: "+9.5/min",
    buildTimesStanding: "+9.5/min",
  });
  expect(surfaces(false, "troops", BuildingType.ResourceKnightT1)).toEqual({
    realmCard: "+202/h",
    buildingPanel: "+202/h",
    buildTimesStanding: "+202/h",
  });
  expect(surfaces(true, "troops", BuildingType.ResourceKnightT1)).toEqual({
    realmCard: "+101/h",
    buildingPanel: "+101/h",
    buildTimesStanding: "+101/h",
  });
});

it("says on a store's card what makes its rate, the buildings and the castle, so the parts add up to it", () => {
  const { store, row, now } = realm();
  expect(storeMakerLines(store, row, ResourcesIds.Labor, now)).toEqual([
    "3 Workshops · +15/min",
    "Castle · +1.7/min",
  ]);
  expect(storeMakerLines(store, row, ResourcesIds.Wheat, now)).toEqual(["3 Farms · +19/min"]);
  expect(storeMakerLines(store, row, ResourcesIds.Knight, now)).toEqual(["2 Barracks · +202/h"]);
  // 3 × 5.04 + 1.68 = 16.8 labor a minute: the rate the chain stores and the card's "+17/min".
  const stored = new ResourceManager(store, 7).current(ResourcesIds.Labor)!.production!.production_rate;
  expect((Number(stored) / 1e9) * 60).toBeCloseTo(3 * 3.36 * 1.5 + 1.68, 6);
  const knights = new ResourceManager(store, 7).current(ResourcesIds.Knight)!.production!.production_rate;
  expect(knights).toBe(56_000_000n);
  expect(buildingsMake(store, row, BuildingType.ResourceKnightT1, now)!.perSecond).toBe(0.056);
});

it("says only what is known of a store's makers until the realm's research arrives, then their combined production", () => {
  const { store, row, now } = realm();
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  // The knowledge row is not in yet (the day-end fixture keeps it under 0xd).
  store.applyFacts([{ model: "RealmKnowledge", key: "0xd", value: null }] as never);
  expect(storeMakerLines(store, row, ResourcesIds.Labor, now)).toEqual(["3 Workshops", "Castle · +1.7/min"]);
  expect(storeMakerLines(store, row, ResourcesIds.Wheat, now)).toEqual(["3 Farms"]);
  // Once it arrives, the combined production includes the learned research.
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: "7", learned: String(knowledge.learned) },
    },
  ] as never);
  expect(storeMakerLines(store, row, ResourcesIds.Labor, now)).toEqual([
    "3 Workshops · +15/min",
    "Castle · +1.7/min",
  ]);
});

it("says what all of a type's buildings make together for its card, and nothing until the realm's research arrives", () => {
  const { store, row, now } = realm();
  const farms = buildingsMake(store, row, BuildingType.ResourceWheat, now)!;
  // Three Farms at 5 wheat a minute with one Fields pick: 3 × 6.3, the one figure the card shows.
  expect(farms.perSecond * 60).toBeCloseTo(3 * 5.04 * 1.25, 6);
  expect(buildingsMake(store, row, BuildingType.RationsDepot, now)).toBeUndefined();
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  store.applyFacts([{ model: "RealmKnowledge", key: "0xd", value: null }] as never);
  expect(buildingsMake(store, row, BuildingType.ResourceWheat, now)).toBeUndefined();
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: "7", learned: String(knowledge.learned) },
    },
  ] as never);
  expect(buildingsMake(store, row, BuildingType.ResourceWheat, now)!.perSecond * 60).toBeCloseTo(3 * 5.04 * 1.25, 6);
});
