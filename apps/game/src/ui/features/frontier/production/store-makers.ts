import { STORE_MAKERS } from "@/ui/design-system/kit/words";
import { buildingOutput } from "@/ui/shared/lib/building-output";
import { getBuildingQuantity, realmLearned } from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, formatCount, formatRate, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import { buildingName } from "../build/building-names";
import { makePicks } from "../research/sides-taken";

/** What Frontier's stores are made by: each product's building, and the research row whose make side raises it. */
const MAKERS = {
  [ResourcesIds.Wheat]: { category: BuildingType.ResourceWheat, row: research.ROW_FARM },
  [ResourcesIds.Labor]: { category: BuildingType.ResourceLabor, row: research.ROW_WORKSHOP },
  [ResourcesIds.Knight]: { category: BuildingType.ResourceKnightT1, row: research.ROW_BARRACKS },
} as const;
type MadeResource = keyof typeof MAKERS;

/**
 * The buildings of a type standing on a realm, from its facts (the packed counts Blitz's tables read too). The castle's
 * own labor producer stands among the Workshops there, and is not one: no research raises it (construction.cairo).
 */
export const standingBuildings = (store: NativeFactStore, realmId: number, category: BuildingType): number => {
  const count = getBuildingQuantity(realmId, category, store);
  return category === BuildingType.ResourceLabor ? Math.max(0, count - 1) : count;
};

/** The picks on the make side (Fields, Tools, Drill) that raise a product's building. */
export const madePicks = (resource: MadeResource, learned: bigint): number => makePicks(learned, MAKERS[resource].row);

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
): BuildingsMake | undefined => {
  const resource = (Object.keys(MAKERS).map(Number) as MadeResource[]).find(
    (each) => MAKERS[each].category === category,
  );
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (resource === undefined || learned === undefined) return undefined;
  const each = buildingOutput(store, realm, category, madePicks(resource, learned));
  return { resource, perSecond: each.total * standingBuildings(store, safeInteger(realm.entity_id), category) };
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
): string[] => {
  const { category } = MAKERS[resource];
  const count = standingBuildings(store, safeInteger(realm.entity_id), category);
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  const name = buildingName(category);
  const standing = formatCount(count, name, name.endsWith("s") ? name : `${name}s`);
  const lines =
    count > 0 ? [learned === undefined ? standing : makersLine(store, realm, resource, learned, standing, count)] : [];
  if (resource === ResourcesIds.Labor) lines.push(STORE_MAKERS.castle(formatRate(castleLabor(store, realm))));
  return lines;
};

/** The buildings standing with their combined production under the realm's research. */
const makersLine = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  resource: MadeResource,
  learned: bigint,
  standing: string,
  count: number,
): string => {
  const each = buildingOutput(store, realm, MAKERS[resource].category, madePicks(resource, learned));
  return STORE_MAKERS.buildings(standing, formatRate(each.total * count));
};

/** The castle's own labor a second: Labor's realm rate, which research never raises. */
const castleLabor = (store: NativeFactStore, realm: NativeRows["Structure"]): number =>
  Number(store.require("ResourceRule", { game_id: realm.game_id, resource_type: ResourcesIds.Labor }).realm_rate) /
  RESOURCE_PRECISION;
