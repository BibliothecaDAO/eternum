import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import {
  CaravanInfoInterface,
  CaravanInterface,
} from "../graphql/useGraphQLQueries";
import { useMemo, useState } from "react";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";

export function useCaravan() {
  const {
    setup: {
      components: { ArrivalTime, Movable, Capacity, Position },
    },
  } = useDojo();

  const getCaravanInfo = (
    caravanId: number,
    orderId: number,
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
      getEntityIdFromKeys([BigInt(orderId)]),
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
    setup: {
      components: {
        Position,
        CaravanMembers,
        OrderId,
        ArrivalTime,
        Movable,
        Capacity,
      },
    },
  } = useDojo();

  const [realmCaravans, setRealmCaravans] = useState<CaravanInterface[]>([]);

  const entityIds = useEntityQuery([
    HasValue(Position, { x, y }),
    Has(CaravanMembers),
  ]);

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
      .filter(Boolean)
      .sort((a, b) => b!.caravanId - a!.caravanId) as CaravanInterface[];
    // DISCUSS: can add sorting logic here
    setRealmCaravans(caravans);
    // only recompute when different number of orders
  }, [entityIds.length]);

  return {
    realmCaravans,
  };
}
