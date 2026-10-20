import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  BUILDINGS_CENTER,
  BuildingType,
  getBuildingFromResource,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";

import { installBuildingRules } from "./fixture-game";

/** The lab's Blitz realm, the fixture's realm 7. */
export const BLITZ_REALM_ID = 7;
/** An open plot beside the castle, in the realm's first ring. */
export const BLITZ_PLOT = { col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1] };

/**
 * The owner's realm's nine resources (owner-blitz-build-panel-20261020.png: Wood, Coal, Copper, Ironwood, Cold Iron,
 * Gold, Adamantine, Mithral, Dragonhide), packed a byte each as the chain packs a realm's resources.
 */
const OWNERS_RESOURCES = [
  ResourcesIds.Wood,
  ResourcesIds.Coal,
  ResourcesIds.Copper,
  ResourcesIds.Ironwood,
  ResourcesIds.ColdIron,
  ResourcesIds.Gold,
  ResourcesIds.Adamantine,
  ResourcesIds.Mithral,
  ResourcesIds.Dragonhide,
];

/** The common building inputs a stocked realm holds 50,000 of. */
const STOCKED = [ResourcesIds.Wood, ResourcesIds.Stone, ResourcesIds.Coal, ResourcesIds.Copper, ResourcesIds.Labor];

/** Every building the panel offers that produces: the realm's resources, food and the army. */
const PRODUCERS = [
  ...OWNERS_RESOURCES.map(getBuildingFromResource),
  BuildingType.ResourceWheat,
  BuildingType.ResourceDonkey,
  BuildingType.ResourcePaladinT1,
  BuildingType.ResourcePaladinT2,
  BuildingType.ResourcePaladinT3,
  BuildingType.ResourceKnightT1,
  BuildingType.ResourceKnightT2,
  BuildingType.ResourceKnightT3,
  BuildingType.ResourceCrossbowmanT1,
  BuildingType.ResourceCrossbowmanT2,
  BuildingType.ResourceCrossbowmanT3,
];

/**
 * Installs the Blitz build panel's realm on the lab game: the owner's nine resources; the recipes the fixture's preset
 * does not carry, as the lab's stand-in (one labor a unit), so a building's detail can say what its production burns;
 * and with `stocked` 50,000 of each common building input (the rare T2 and T3 inputs it never holds). Without it the
 * realm holds what the fixture leaves, little, so most buildings wait.
 */
export const installBlitzBuildRealm = (store: NativeFactStore, stocked: boolean): void => {
  installBuildingRules(store, PRODUCERS);
  const realm = store.require("Structure", { game_id: 1, entity_id: BLITZ_REALM_ID });
  const packed = OWNERS_RESOURCES.reduce((sum, resource, index) => sum | (BigInt(resource) << BigInt(8 * index)), 0n);
  store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...realm, resources_packed: `0x${packed.toString(16)}` } },
    ...(stocked
      ? STOCKED.map((resource) => ({
          model: "ResourceBalance",
          key: `0xb5${resource}`,
          value: {
            game_id: 1,
            entity_id: BLITZ_REALM_ID,
            resource_type: resource,
            balance: String(50_000n * BigInt(RESOURCE_PRECISION)),
          },
        }))
      : []),
  ] as never);
};
