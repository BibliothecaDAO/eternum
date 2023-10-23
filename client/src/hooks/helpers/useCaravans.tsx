import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { CaravanInterface } from "../graphql/useGraphQLQueries";
import { useMemo, useState } from "react";
import { getEntityIdFromKeys, padAddress } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";

const FREE_TRANSPORT_ENTITY_TYPE = 256;

export function useCaravan() {
  const {
    account: { account },
    setup: {
      components: { ArrivalTime, Movable, Capacity, Position, OrderId, Owner, QuantityTracker },
    },
  } = useDojo();

  const getCaravanInfo = (caravanId: number): CaravanInterface => {
    const orderId = getComponentValue(OrderId, getEntityIdFromKeys([BigInt(caravanId)]));
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(caravanId)]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([BigInt(caravanId)]));
    const capacity = getComponentValue(Capacity, getEntityIdFromKeys([BigInt(caravanId)]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(caravanId)]));
    const rawDestination = orderId ? getComponentValue(Position, getEntityIdFromKeys([BigInt(orderId.id)])) : undefined;
    let destination = rawDestination ? { x: rawDestination.x, y: rawDestination.y } : undefined;
    return {
      caravanId,
      orderId: orderId?.id,
      arrivalTime: arrivalTime?.arrives_at,
      blocked: movable?.blocked,
      capacity: capacity?.weight_gram,
      destination,
      owner: owner?.address,
      isMine: padAddress(owner?.address || "0x0") === padAddress(account.address),
    };
  };

  function calculateDistance(startId: number, destinationId: number): number | undefined {
    // d = √((x2-x1)² + (y2-y1)²)
    let start = getComponentValue(Position, getEntityIdFromKeys([BigInt(startId)]));
    let destination = getComponentValue(Position, getEntityIdFromKeys([BigInt(destinationId)]));
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

  function getRealmDonkeysCount(realmEntityId: number): number {
    const donkeysQuantity = getComponentValue(
      QuantityTracker,
      getEntityIdFromKeys([BigInt(realmEntityId), BigInt(FREE_TRANSPORT_ENTITY_TYPE)]),
    );

    return donkeysQuantity?.count || 0;
  }
  return { getCaravanInfo, calculateDistance, getRealmDonkeysCount };
}

export function useGetPositionCaravans(x: number, y: number) {
  const {
    setup: {
      components: { Position, CaravanMembers },
    },
  } = useDojo();

  const [caravans, setCaravans] = useState<CaravanInterface[]>([]);

  const entityIds = useEntityQuery([HasValue(Position, { x, y }), Has(CaravanMembers)]);

  const { getCaravanInfo } = useCaravan();

  useMemo((): any => {
    const caravans = entityIds
      .map((id) => {
        return getCaravanInfo(id);
      })
      .filter(Boolean)
      .sort((a, b) => b!.caravanId - a!.caravanId) as CaravanInterface[];
    // DISCUSS: can add sorting logic here
    setCaravans([...caravans]);
    // only recompute when different number of orders
  }, [entityIds.length]);

  return {
    caravans,
  };
}
