import {
  EntityIndex,
  getComponentValue,
  getEntitiesWithValue,
} from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import {
  CaravanInfoInterface,
  CaravanInterface,
} from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useState } from "react";
import { getEntityIdFromKeys } from "../../utils/utils";

export function useCaravan() {
  const {
    setup: { components: { ArrivalTime, Movable, Capacity, Position } }
  } = useDojo();

  const getCaravanInfo = (
    caravanId: number,
    counterPartyOrderId: number,
  ): CaravanInfoInterface | undefined => {
    const arrivalTime = getComponentValue(
      ArrivalTime,
      getEntityIdFromKeys([BigInt(caravanId)]),
    );
    const movable = getComponentValue(
      Movable,
      getEntityIdFromKeys([BigInt(caravanId)]),
    );
    const capacity = getComponentValue(
      Capacity,
      getEntityIdFromKeys([BigInt(caravanId)]),
    );
    const rawDestination = getComponentValue(
      Position,
      getEntityIdFromKeys([BigInt(counterPartyOrderId)]),
    );
    let destination = rawDestination
      ? { x: rawDestination.x, y: rawDestination.y }
      : undefined;
    if (movable && capacity) {
      return {
        arrivalTime: arrivalTime?.arrives_at,
        blocked: movable.blocked,
        capacity: capacity.weight_gram,
        destination,
      };
    }
  };

  return { getCaravanInfo };
}

export function useGetRealmCaravans(x: number, y: number) {
  const {
    setup: { components: {
      Position,
      CaravanMembers,
      OrderId,
      ArrivalTime,
      Movable,
      Capacity,
    } },
  } = useDojo();

  const [realmCaravans, setRealmCaravans] = useState<CaravanInterface[]>([]);
  const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);

  // TODO: replace that by getting entities with a certain maker Id
  useEffect(() => {
    const getEntities = () => {
      const set1 = getEntitiesWithValue(Position, { x, y });
      const set2 = getEntitiesWithValue(CaravanMembers, {});
      const entityIds = Array.from(set1).filter((value) => set2.has(value));
      setEntityIds(entityIds);
    };
    getEntities();
    const intervalId = setInterval(getEntities, 1000); // Fetch every second
    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [x, y]);

  useMemo(() => {
    const caravans = entityIds
      .map((id) => {
        let orderId = getComponentValue(OrderId, id);
        let capacity = getComponentValue(Capacity, id);
        let arrivalTime = getComponentValue(ArrivalTime, id);
        let movable = getComponentValue(Movable, id);
        if (orderId && capacity && movable) {
          return {
            caravanId: id,
            orderId: orderId.id,
            blocked: movable.blocked,
            arrivalTime: arrivalTime?.arrives_at,
            capacity: capacity.weight_gram,
          } as CaravanInterface;
        }
      })
      .filter(Boolean) as CaravanInterface[];
    setRealmCaravans(caravans);
    // only recompute when different number of orders
  }, [entityIds.length]);

  return {
    realmCaravans,
  };
}
