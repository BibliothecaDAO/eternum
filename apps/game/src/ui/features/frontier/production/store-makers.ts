import { RESEARCH_TREE, fromResearch, STORE_MAKERS } from "@/ui/design-system/kit/words";
import { buildingOutput } from "@/ui/shared/lib/building-output";
import { getBuildingQuantity, realmLearned } from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import {
  BuildingType,
  formatCount,
  formatPercent,
  formatRate,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";

import { buildingName } from "../build/building-names";
import { makePicks } from "../research/sides-taken";

/** What Frontier's stores are made by: each product's building, and the research row whose make side raises it. */
const MAKERS = {
  [ResourcesIds.Wheat]: {
    category: BuildingType.ResourceWheat,
    row: research.ROW_FARM,
    side: RESEARCH_TREE.sides.fields[0],
  },
  [ResourcesIds.Labor]: {
    category: BuildingType.ResourceLabor,
    row: research.ROW_WORKSHOP,
    side: RESEARCH_TREE.sides.tools[0],
  },
  [ResourcesIds.Knight]: {
    category: BuildingType.ResourceKnightT1,
    row: research.ROW_BARRACKS,
    side: RESEARCH_TREE.sides.drill[0],
  },
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

/** What research adds to one building of a product's type: its make side, its picks, and the share they add. */
export type ResearchShare = { side: string; picks: number; share: number };

/** The share a product's make side adds with the given research, from the board's step; none before a pick. */
export const researchShare = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  resource: MadeResource,
  learned: bigint,
): ResearchShare | undefined => {
  const { row, side } = MAKERS[resource];
  const picks = makePicks(learned, row);
  if (picks === 0) return undefined;
  const step = store.require("BoardRules", { game_id: realm.game_id }).output_step_bps;
  return { side, picks, share: (picks * step) / 10_000 };
};

/** The research reason for a building's rate, without repeating the calculation. */
export const outputWhy = (research: ResearchShare | undefined): string | undefined =>
  research && fromResearch(formatPercent(research.share, { signed: true }), research.side);

/** What all of a type's standing buildings make: their product, its rate a second, and the side that raises it. */
type BuildingsMake = { resource: MadeResource; perSecond: number; research?: ResearchShare };

/**
 * What every standing building of a type makes together, the one figure its card shows ("+25/min"), with the research
 * side behind it for the card's why. None for a type that makes nothing stored, or while the realm's research is
 * unknown (never the unresearched rate).
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
  const research = researchShare(store, realm, resource, learned);
  const each = buildingOutput(store, realm, category, research?.picks ?? 0);
  return {
    resource,
    perSecond: each.total * standingBuildings(store, safeInteger(realm.entity_id), category),
    research,
  };
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
  const research = researchShare(store, realm, resource, learned);
  const each = buildingOutput(store, realm, MAKERS[resource].category, research?.picks ?? 0);
  return STORE_MAKERS.buildings(standing, formatRate(each.total * count));
};

/** The castle's own labor a second: Labor's realm rate, which research never raises. */
const castleLabor = (store: NativeFactStore, realm: NativeRows["Structure"]): number =>
  Number(store.require("ResourceRule", { game_id: realm.game_id, resource_type: ResourcesIds.Labor }).realm_rate) /
  RESOURCE_PRECISION;
