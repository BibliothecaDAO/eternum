import type { ClientComponents, ID, ResourceArrivalInfo } from "@bibliothecadao/types";
import { type Entity, Has, HasValue, type QueryFragment } from "@dojoengine/recs";

import { ResourceManager } from "../../managers/resource-manager";
import { formatArrivals } from "../../utils/resource-arrivals";
import { readRows } from "./rows";

/** The Resource row a manager reads; a hook subscribes to it, a one-shot reader does not need it. */
export const resourcesOfEntityQuery = (components: ClientComponents, entityId: ID): QueryFragment[] => [
  HasValue(components.Resource, { entity_id: entityId }),
];

export const readResourceManager = (components: ClientComponents, entityId: ID): ResourceManager =>
  new ResourceManager(components, entityId);

export const arrivalsByStructureQuery = (components: ClientComponents, structureEntityId: ID): QueryFragment[] => [
  Has(components.ResourceArrival),
  HasValue(components.ResourceArrival, { structure_id: structureEntityId }),
];

/** One entry per filled delivery slot, with its arrival time from the active game's delivery tick. */
export const readResourceArrivals = (components: ClientComponents, entities: Entity[]): ResourceArrivalInfo[] =>
  formatArrivals(readRows(components.ResourceArrival, entities));
