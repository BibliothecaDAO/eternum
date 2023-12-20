import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { CaravanInterface } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { divideByPrecision, getEntityIdFromKeys, getForeignKeyEntityId, padAddress } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";

const FREE_TRANSPORT_ENTITY_TYPE = 256;

export function useCaravan() {
  const {
    account: { account },
    setup: {
      components: {
        ArrivalTime,
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

  const getCaravanInfo = (caravanId: bigint): CaravanInterface => {
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([caravanId]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([caravanId]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([caravanId]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([caravanId]));
    const resourcesChestId = getInventoryResourcesChestId(caravanId);
    const resourceChest = resourcesChestId
      ? getComponentValue(ResourceChest, getEntityIdFromKeys([BigInt(resourcesChestId)]))
      : undefined;
    // const resources_chest_id =
    const rawDestination = movable ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y } : undefined;
    let destination = rawDestination ? { x: rawDestination.x, y: rawDestination.y } : undefined;

    return {
      caravanId,
      arrivalTime: arrivalTime?.arrives_at,
      pickupArrivalTime: resourceChest?.locked_until,
      resourcesChestId,
      blocked: movable?.blocked,
      capacity: divideByPrecision(Number(capacity?.weight_gram) || 0),
      destination,
      owner: owner?.address,
      isMine: owner?.address === BigInt(account.address),
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
      const x: number =
        start.x > destination.x ? Math.pow(start.x - destination.x, 2) : Math.pow(destination.x - start.x, 2);

      const y: number =
        start.y > destination.y ? Math.pow(start.y - destination.y, 2) : Math.pow(destination.y - start.y, 2);

      // Using bitwise shift for the square root approximation for BigInt.
      // we store coords in x * 10000 to get precise distance
      const distance = (x + y) ** 0.5 / 10000;

      return distance;
    }
  }

  const useGetPositionCaravans = (x: number, y: number) => {
    const [caravans, setCaravans] = useState<CaravanInterface[]>([]);

    const entityIds = useEntityQuery([HasValue(Position, { x, y }), Has(CaravanMembers)]);

    const { getCaravanInfo } = useCaravan();

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

  function getRealmDonkeysCount(realmEntityId: bigint): number {
    let hashedKeys = getEntityIdFromKeys([BigInt(realmEntityId), BigInt(FREE_TRANSPORT_ENTITY_TYPE)]);
    const donkeysQuantity = getComponentValue(QuantityTracker, getEntityIdFromKeys([BigInt(hashedKeys)]));

    return Number(donkeysQuantity?.count) || 0;
  }
  return {
    useGetPositionCaravansIds,
    useGetPositionCaravans,
    getCaravanInfo,
    calculateDistance,
    getRealmDonkeysCount,
    getInventoryResourcesChestId,
  };
}
