import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { CaravanInterface, DESTINATION_TYPE } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { divideByPrecision, getEntityIdFromKeys, getForeignKeyEntityId } from "../../ui/utils/utils";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { useHyperstructure } from "./useHyperstructure";
import { useResources } from "./useResources";

const FREE_TRANSPORT_ENTITY_TYPE = 256;

export function useCaravan() {
  const {
    account: { account },
    setup: {
      components: {
        ArrivalTime,
        EntityOwner,
        Movable,
        Capacity,
        OwnedResourcesTracker,
        Position,
        Owner,
        QuantityTracker,
        ForeignKey,
      },
    },
  } = useDojo();

  const { getResourcesFromBalance } = useResources();

  const getEntityInfo = (entityId: bigint): CaravanInterface => {
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([entityId]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([entityId]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([entityId]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([entityId]));
    const track = getComponentValue(OwnedResourcesTracker, getEntityIdFromKeys([entityId]));
    console.log({ track });
    const resources = getResourcesFromBalance(entityId);
    const rawIntermediateDestination = movable
      ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y }
      : undefined;
    const intermediateDestination = rawIntermediateDestination
      ? { x: rawIntermediateDestination.x, y: rawIntermediateDestination.y }
      : undefined;

    const position = getComponentValue(Position, getEntityIdFromKeys([entityId]));

    const ownerEntity = getComponentValue(EntityOwner, getEntityIdFromKeys([entityId]))?.entity_owner_id;
    const homePosition = ownerEntity
      ? getComponentValue(Position, getEntityIdFromKeys([BigInt(ownerEntity)]))
      : undefined;

    return {
      entityId,
      arrivalTime: arrivalTime?.arrives_at,
      blocked: Boolean(movable?.blocked),
      capacity: divideByPrecision(Number(capacity?.weight_gram) || 0),
      intermediateDestination,
      position: position ? { x: position.x, y: position.y } : undefined,
      homePosition: homePosition ? { x: homePosition.x, y: homePosition.y } : undefined,
      owner: owner?.address,
      isMine: owner?.address === BigInt(account.address),
      isRoundTrip: movable?.round_trip || false,
      resources,
    };
  };

  const getInventoryResourcesChestId = (caravanId: bigint): bigint | undefined => {
    const inventory = getComponentValue(Inventory, getEntityIdFromKeys([caravanId]));
    let foreignKey = inventory
      ? getComponentValue(ForeignKey, getForeignKeyEntityId(caravanId, inventory.items_key, 0n))
      : undefined;
    return foreignKey?.entity_id;
  };

  function calculateDistance(startId: bigint, destinationId: bigint): number | undefined {
    // d = √((x2-x1)² + (y2-y1)²)
    let start = getComponentValue(Position, getEntityIdFromKeys([startId]));
    let destination = getComponentValue(Position, getEntityIdFromKeys([destinationId]));
    if (start && destination) {
      // Calculate the difference in x and y coordinates
      const deltaX = Math.abs(start.x - destination.x);
      const deltaY = Math.abs(start.y - destination.y);

      // Calculate the distance using the Pythagorean theorem
      // Each tile is 1 km, so we don't need to divide by 10000 here
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      return distance;
    }
  }

  function useRealmDonkeysCount(realmEntityId: bigint) {
    let hashedKeys = getEntityIdFromKeys([BigInt(realmEntityId), BigInt(FREE_TRANSPORT_ENTITY_TYPE)]);
    return useComponentValue(QuantityTracker, getEntityIdFromKeys([BigInt(hashedKeys)]));
  }

  function getRealmDonkeysCount(realmEntityId: bigint): number {
    let hashedKeys = getEntityIdFromKeys([BigInt(realmEntityId), BigInt(FREE_TRANSPORT_ENTITY_TYPE)]);
    const donkeysQuantity = getComponentValue(QuantityTracker, getEntityIdFromKeys([BigInt(hashedKeys)]));

    return Number(donkeysQuantity?.count) || 0;
  }
  return {
    getCaravanInfo: getEntityInfo,
    calculateDistance,
    getRealmDonkeysCount,
    useRealmDonkeysCount,
    getInventoryResourcesChestId,
  };
}
