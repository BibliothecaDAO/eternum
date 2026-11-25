import { STORE_MAKERS } from "@/ui/design-system/kit/words";
import { buildingOutput } from "@/ui/shared/lib/building-output";
import { buildingMakePicks, getBuildingQuantity, readProductionPercent, realmLearned } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, formatCount, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import { buildingName } from "../build/building-names";
import { formatStoreRate, FRONTIER_STORES, madeStore, type MadeResource, storeBuilding, storeMadeBy } from "../stores";

/**
 * The buildings of a type standing on a realm, from its facts (the packed counts Blitz's tables read too). The castle's
 * own labor producer stands among the Workshops there, and is not one: no research raises it (construction.cairo).
 */
export const standingBuildings = (store: NativeFactStore, realmId: number, category: BuildingType): number => {
  const count = getBuildingQuantity(realmId, category, store);
  return category === BuildingType.ResourceLabor ? Math.max(0, count - 1) : count;
};

/** Output research on the building that makes this resource. */
export const madePicks = (resource: MadeResource, learned: bigint): number =>
  buildingMakePicks(learned, storeBuilding(madeStore(resource)));

/** What all of a type's standing buildings make: their product and its rate a second. */
type BuildingsMake = { resource: MadeResource; perSecond: number };

/**
 * What every standing building of a type makes together, the one figure its card shows ("+25/min"). None for a type
 * that makes nothing stored, or while the realm's research is unknown (never the unresearched rate).
 */
export const buildingsMake = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
  now: number,
): BuildingsMake | undefined => {
  const made = storeMadeBy(category);
  const resource = made === undefined ? undefined : FRONTIER_STORES[made].resource;
  const each = resource === undefined ? undefined : buildingRate(store, realm, resource, now);
  if (resource === undefined || each === undefined) return undefined;
  return { resource, perSecond: each * standingBuildings(store, safeInteger(realm.entity_id), category) };
};

export const buildingRate = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  resource: MadeResource,
  now: number,
): number | undefined => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  const percent = readProductionPercent(store, realm.game_id, realm.entity_id, now);
  if (learned === undefined || percent === undefined) return undefined;
  const category = storeBuilding(madeStore(resource));
  return (buildingOutput(store, realm, category, madePicks(resource, learned)).total * percent) / 100;
};

/**
 * What makes a store's rate, line by line, so its parts add up to the rate the card shows: the buildings standing with
 * their combined production, and for labor the castle's own producer (player, 25 October: "+17" counted a castle no screen
 * showed). None where no building stands and no castle makes it. While the realm's research is unknown, what each
 * building makes is too: its line says how many stand and nothing more, never the unresearched rate.
 */
export const storeMakerLines = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  resource: MadeResource,
  now: number,
): string[] => {
  const kind = madeStore(resource);
  const category = storeBuilding(kind);
  const count = standingBuildings(store, safeInteger(realm.entity_id), category);
  const each = buildingRate(store, realm, resource, now);
  const name = buildingName(category);
  const standing = formatCount(count, name, name.endsWith("s") ? name : `${name}s`);
  const lines =
    count > 0
      ? [each === undefined ? standing : STORE_MAKERS.buildings(standing, formatStoreRate(kind, each * count))]
      : [];
  if (resource === ResourcesIds.Labor)
    lines.push(STORE_MAKERS.castle(formatStoreRate(kind, castleLabor(store, realm, now))));
  return lines;
};

export const castleLabor = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  now: number,
): number | undefined => {
  const percent = readProductionPercent(store, realm.game_id, realm.entity_id, now);
  const rate = store.require("ResourceRule", { game_id: realm.game_id, resource_type: ResourcesIds.Labor }).realm_rate;
  return percent === undefined ? undefined : (Number(rate) / RESOURCE_PRECISION) * (percent / 100);
};
