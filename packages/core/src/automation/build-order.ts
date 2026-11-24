import {
  BuildingType,
  getBuildingFromResource,
  getResourceTiers,
  RealmLevels,
  type ResourcesIds,
  TroopTier,
} from "@bibliothecadao/types";

const readBlitzResources = () => {
  const tiers = getResourceTiers(true);
  if (!("materials" in tiers)) throw new Error("Blitz's resource catalog has no materials");
  return tiers;
};
const BLITZ_RESOURCES = readBlitzResources();
const BLITZ_PRODUCERS = new Map<BuildingType, ResourcesIds>(
  [
    ...BLITZ_RESOURCES.food,
    ...BLITZ_RESOURCES.materials,
    ...BLITZ_RESOURCES.transport,
    ...BLITZ_RESOURCES.military,
  ].map((resource) => [getBuildingFromResource(resource), resource]),
);

export const blitzBuildingResource = (building: BuildingType): ResourcesIds | undefined =>
  BLITZ_PRODUCERS.get(building);

export type DefaultBuildStep =
  | { rank: RealmLevels; kind: "building"; building: BuildingType; count: number }
  | { rank: RealmLevels; kind: "barracks"; tier: TroopTier; count: number }
  | { rank: RealmLevels; kind: "army"; tier: TroopTier; count: number };

const building = (rank: RealmLevels, target: BuildingType, count: number): DefaultBuildStep => ({
  rank,
  kind: "building",
  building: target,
  count,
});
const barracks = (rank: RealmLevels, count: number): DefaultBuildStep => ({
  rank,
  kind: "barracks",
  tier: TroopTier.T1,
  count,
});
const army = (rank: RealmLevels, count: number): DefaultBuildStep => ({
  rank,
  kind: "army",
  tier: TroopTier.T1,
  count,
});

export const DEFAULT_BUILD_STEPS: readonly DefaultBuildStep[] = [
  building(RealmLevels.Settlement, BuildingType.ResourceWheat, 2),
  building(RealmLevels.City, BuildingType.ResourceWheat, 4),
  building(RealmLevels.City, BuildingType.ResourceWood, 1),
  building(RealmLevels.City, BuildingType.ResourceCoal, 1),
  building(RealmLevels.City, BuildingType.ResourceCopper, 1),
  building(RealmLevels.City, BuildingType.ResourceWood, 2),
  building(RealmLevels.City, BuildingType.ResourceCoal, 2),
  building(RealmLevels.City, BuildingType.ResourceCopper, 2),
  barracks(RealmLevels.City, 1),
  army(RealmLevels.City, 1),
  building(RealmLevels.Kingdom, BuildingType.ResourceWheat, 8),
  building(RealmLevels.Kingdom, BuildingType.ResourceWood, 3),
  building(RealmLevels.Kingdom, BuildingType.ResourceCoal, 3),
  building(RealmLevels.Kingdom, BuildingType.ResourceCopper, 3),
  building(RealmLevels.Kingdom, BuildingType.ResourceWood, 4),
  building(RealmLevels.Kingdom, BuildingType.ResourceCoal, 4),
  building(RealmLevels.Kingdom, BuildingType.ResourceCopper, 4),
  barracks(RealmLevels.Kingdom, 3),
  building(RealmLevels.Empire, BuildingType.ResourceWheat, 12),
  building(RealmLevels.Empire, BuildingType.ResourceWood, 5),
  building(RealmLevels.Empire, BuildingType.ResourceCoal, 5),
  building(RealmLevels.Empire, BuildingType.ResourceCopper, 5),
  building(RealmLevels.Empire, BuildingType.ResourceWood, 6),
  building(RealmLevels.Empire, BuildingType.ResourceCoal, 6),
  building(RealmLevels.Empire, BuildingType.ResourceCopper, 6),
  barracks(RealmLevels.Empire, 5),
];
