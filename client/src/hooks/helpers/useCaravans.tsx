import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { CaravanInterface } from "../graphql/useGraphQLQueries";
import { useMemo, useState } from "react";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";

export function useCaravan() {
  const {
    setup: {
      components: { ArrivalTime, Movable, Capacity, Position, OrderId },
    },
  } = useDojo();

  const getCaravanInfo = (caravanId: number): CaravanInterface => {
    const orderId = getComponentValue(OrderId, getEntityIdFromKeys([BigInt(caravanId)]));
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(caravanId)]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([BigInt(caravanId)]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([BigInt(caravanId)]));
    const rawDestination = orderId ? getComponentValue(Position, getEntityIdFromKeys([BigInt(orderId.id)])) : undefined;
    let destination = rawDestination ? { x: rawDestination.x, y: rawDestination.y } : undefined;
    return {
      caravanId,
      orderId: orderId?.id,
      arrivalTime: arrivalTime?.arrives_at,
      blocked: movable?.blocked,
      capacity: capacity?.weight_gram,
      destination,
    };
  };

  return { getCaravanInfo };
}

export function useGetRealmCaravans(x: number, y: number) {
  const {
    setup: {
      components: { Position, CaravanMembers },
    },
  } = useDojo();

  const [realmCaravans, setRealmCaravans] = useState<CaravanInterface[]>([]);

  const entityIds = useEntityQuery([HasValue(Position, { x, y }), Has(CaravanMembers)]);

  const { getCaravanInfo } = useCaravan();

  useMemo(() => {
    const caravans = entityIds
      .map((id) => {
        return getCaravanInfo(id);
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
