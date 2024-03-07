import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { CaravanInterface, DESTINATION_TYPE } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { divideByPrecision, getEntityIdFromKeys, getForeignKeyEntityId } from "../../utils/utils";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { useHyperstructure } from "./useHyperstructure";
import { useBanks } from "./useBanks";

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
        Position,
        Owner,
        QuantityTracker,
        Inventory,
        ForeignKey,
        ResourceChest,
        CaravanMembers,
      },
    },
  } = useDojo();

  const { getHyperstructureEntityId } = useHyperstructure();
  const { getBankEntityId } = useBanks();

  const getCaravanInfo = (caravanId: bigint): CaravanInterface => {
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([caravanId]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([caravanId]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([caravanId]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([caravanId]));
    const resourcesChestId = getInventoryResourcesChestId(caravanId);
    const resourceChest = resourcesChestId
      ? getComponentValue(ResourceChest, getEntityIdFromKeys([BigInt(resourcesChestId)]))
      : undefined;
    const rawIntermediateDestination = movable
      ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y }
      : undefined;
    const intermediateDestination = rawIntermediateDestination
      ? { x: rawIntermediateDestination.x, y: rawIntermediateDestination.y }
      : undefined;

    const position = getComponentValue(Position, getEntityIdFromKeys([caravanId]));

    let destinationType: DESTINATION_TYPE | undefined;
    if (position && getHyperstructureEntityId({ x: position.x, y: position.y })) {
      destinationType = DESTINATION_TYPE.HYPERSTRUCTURE;
    } else if (position && getBankEntityId({ x: position.x, y: position.y })) {
      destinationType = DESTINATION_TYPE.BANK;
    } else {
      destinationType = DESTINATION_TYPE.HOME;
    }

    return {
      caravanId,
      arrivalTime: arrivalTime?.arrives_at,
      pickupArrivalTime: resourceChest?.locked_until,
      resourcesChestId,
      blocked: Boolean(movable?.blocked),
      capacity: divideByPrecision(Number(capacity?.weight_gram) || 0),
      intermediateDestination,
      position: position ? { x: position.x, y: position.y } : undefined,
      owner: owner?.address,
      isMine: owner?.address === BigInt(account.address),
      isRoundTrip: movable?.round_trip || false,
      destinationType,
    };
  };

  const getInventoryResourcesChestId = (caravanId: bigint): bigint | undefined => {
    const inventory = getComponentValue(Inventory, getEntityIdFromKeys([caravanId]));
    let foreignKey = inventory
      ? getComponentValue(ForeignKey, getForeignKeyEntityId(caravanId, inventory.items_key, 0n))
      : undefined;
    return foreignKey?.entity_id;
  };

  const getCaravanMembers = (caravanId: bigint): bigint[] => {
    const caravanMembers = getComponentValue(CaravanMembers, getEntityIdFromKeys([caravanId]));
    let unitIds: bigint[] = [];
    if (!caravanMembers) return unitIds;
    for (let i = 0; i < caravanMembers.count; i++) {
      let entityId = getForeignKeyEntityId(caravanId, caravanMembers.key, BigInt(i));
      let foreignKey = getComponentValue(ForeignKey, entityId);
      if (foreignKey) {
        unitIds.push(foreignKey.entity_id);
      }
    }
    return unitIds;
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

  const useGetPositionCaravans = (x: number, y: number) => {
    const [caravans, setCaravans] = useState<CaravanInterface[]>([]);

    const entityIds = useEntityQuery([HasValue(Position, { x, y }), Has(CaravanMembers)]);

    useMemo((): any => {
      const caravans = entityIds
        .map((id) => {
          const position = getComponentValue(Position, id);
          return getCaravanInfo(position!.entity_id);
        })
        .filter(Boolean)
        .sort((a, b) => Number(b!.caravanId - a!.caravanId)) as CaravanInterface[];
      // DISCUSS: can add sorting logic here
      setCaravans([...caravans]);
      // only recompute when different number of orders
    }, [entityIds.length]);

    return {
      caravans,
    };
  };

  const useGetEntityCaravans = (entityId: bigint) => {
    const [caravans, setCaravans] = useState<CaravanInterface[]>([]);

    const entityIds = useEntityQuery([Has(CaravanMembers), HasValue(EntityOwner, { entity_owner_id: entityId })]);

    useMemo((): any => {
      const caravans = entityIds
        .map((id) => {
          const position = getComponentValue(Position, id);
          return getCaravanInfo(position!.entity_id);
        })
        .filter(Boolean)
        .sort((a, b) => Number(b!.caravanId - a!.caravanId)) as CaravanInterface[];
      // DISCUSS: can add sorting logic here
      setCaravans([...caravans]);
      // only recompute when different number of orders
    }, [entityIds.length]);

    return {
      caravans,
    };
  };

  const useGetPositionCaravansIds = (x: number, y: number) => {
    const entityIds = useEntityQuery([HasValue(Position, { x, y }), Has(CaravanMembers)]);

    return Array.from(entityIds).map((id) => {
      const owner = getComponentValue(Owner, id);
      const position = getComponentValue(Position, id);
      return {
        owner: owner?.address,
        isMine: owner?.address === BigInt(account.address),
        caravanId: position!.entity_id,
      };
    });
  };

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
    getCaravanMembers,
    useGetPositionCaravansIds,
    useGetPositionCaravans,
    useGetEntityCaravans,
    getCaravanInfo,
    calculateDistance,
    getRealmDonkeysCount,
    useRealmDonkeysCount,
    getInventoryResourcesChestId,
  };
}
