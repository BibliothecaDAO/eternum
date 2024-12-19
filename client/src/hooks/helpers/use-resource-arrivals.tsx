import { ContractAddress, ID, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import {
  Entity,
  Has,
  HasValue,
  NotValue,
  defineQuery,
  getComponentValue,
  isComponentUpdate,
  runQuery,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDojo } from "../context/DojoContext";
import useNextBlockTimestamp from "../useNextBlockTimestamp";

export type ArrivalInfo = {
  entityId: ID;
  recipientEntityId: ID;
  position: Position;
  arrivesAt: bigint;
  isOwner: boolean;
  hasResources: boolean;
  isHome: boolean;
  // resources: Resource[];
};

const usePlayerArrivals = () => {
  const {
    account: { account },
    setup: {
      components: { Position, Owner, EntityOwner, OwnedResourcesTracker, ArrivalTime, Weight, Resource, Structure },
    },
  } = useDojo();

  const playerStructures = useEntityQuery([
    Has(Structure),
    HasValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const playerStructurePositions = useMemo(() => {
    return playerStructures.map((entityId) => {
      const position = getComponentValue(Position, entityId);
      return { x: position?.x ?? 0, y: position?.y ?? 0, entityId: position?.entity_id || 0 };
    });
  }, [playerStructures, Position]);

  const [entitiesWithInventory, setEntitiesWithInventory] = useState<ArrivalInfo[]>([]);

  const queryFragments = [
    Has(Weight),
    Has(ArrivalTime),
    Has(EntityOwner),
    NotValue(OwnedResourcesTracker, { resource_types: 0n }),
  ];

  const getArrivalsWithResourceOnPosition = useCallback((positions: Position[]) => {
    const arrivals = positions.flatMap((position) => {
      return Array.from(runQuery([HasValue(Position, { x: position.x, y: position.y }), ...queryFragments]));
    });
    return arrivals;
  }, []);

  const createArrivalInfo = useCallback(
    (id: Entity): ArrivalInfo | undefined => {
      const position = getComponentValue(Position, id);
      if (!position) return undefined;

      const arrivalTime = getComponentValue(ArrivalTime, id);
      if (!arrivalTime) return undefined;

      const entityOwner = getComponentValue(EntityOwner, id);
      const ownerEntityId = getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]);
      const owner = getComponentValue(Owner, ownerEntityId);

      if (owner?.address !== ContractAddress(account.address)) {
        return undefined;
      }

      const ownedResourceTracker = getComponentValue(OwnedResourcesTracker, id);

      const hasResources = !!ownedResourceTracker && ownedResourceTracker.resource_types !== 0n;

      const playerStructurePosition = playerStructurePositions.find(
        (structurePosition) => structurePosition.x === position.x && structurePosition.y === position.y,
      );

      const isHome = !!playerStructurePosition;

      return {
        entityId: position.entity_id,
        recipientEntityId: playerStructurePosition?.entityId || 0,
        arrivesAt: arrivalTime.arrives_at,
        isOwner: true,
        position: { x: position.x, y: position.y },
        hasResources,
        isHome,
      };
    },
    [account, playerStructurePositions],
  );

  // initial load
  useEffect(() => {
    const arrivals = getArrivalsWithResourceOnPosition(playerStructurePositions)
      .map(createArrivalInfo)
      .filter((arrival): arrival is ArrivalInfo => arrival !== undefined)
      .filter((arrival) => arrival.hasResources);
    setEntitiesWithInventory(arrivals);
  }, [playerStructurePositions, getArrivalsWithResourceOnPosition, createArrivalInfo]);

  const isMine = useCallback(
    (entity: Entity) => {
      const entityOwner = getComponentValue(EntityOwner, entity);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
      return owner?.address === ContractAddress(account.address);
    },
    [account.address],
  );

  useEffect(() => {
    const query = defineQuery([Has(Position), ...queryFragments], { runOnInit: false });

    const handleArrivalUpdate = (arrivals: ArrivalInfo[], newArrival: ArrivalInfo | undefined) => {
      if (!newArrival) return arrivals;

      if (!newArrival.hasResources || !newArrival.isHome) {
        return arrivals.filter((arrival) => arrival.entityId !== newArrival.entityId);
      }

      const index = arrivals.findIndex((arrival) => arrival.entityId === newArrival.entityId);
      if (index !== -1) {
        return [...arrivals.slice(0, index), newArrival, ...arrivals.slice(index + 1)];
      }
      return [...arrivals, newArrival];
    };

    const sub = query.update$.subscribe((update) => {
      if (
        isComponentUpdate(update, Position) ||
        isComponentUpdate(update, Weight) ||
        isComponentUpdate(update, EntityOwner) ||
        isComponentUpdate(update, ArrivalTime) ||
        isComponentUpdate(update, OwnedResourcesTracker)
      ) {
        const isThisMine = isMine(update.entity);

        isThisMine &&
          setEntitiesWithInventory((arrivals) => handleArrivalUpdate(arrivals, createArrivalInfo(update.entity)));
      }
    });

    return () => sub.unsubscribe();
  }, [account, playerStructurePositions, createArrivalInfo, isMine]);

  return useMemo(
    () => entitiesWithInventory.sort((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt)),
    [entitiesWithInventory],
  );
};

export const usePlayerArrivalsNotifications = () => {
  const [arrivedNotificationLength, setArrivedNotificationLength] = useState(0);
  const [nonArrivedNotificationLength, setNonArrivedNotificationLength] = useState(0);

  const arrivals = usePlayerArrivals();

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  useEffect(() => {
    const arrivedCount = arrivals.filter(
      (arrival) => Number(arrival.arrivesAt) <= (nextBlockTimestamp || 0) && arrival.hasResources,
    ).length;
    const nonArrivedCount = arrivals.filter(
      (arrival) => Number(arrival.arrivesAt) > (nextBlockTimestamp || 0) && arrival.hasResources,
    ).length;
    setArrivedNotificationLength(arrivedCount);
    setNonArrivedNotificationLength(nonArrivedCount);
  }, [arrivals, nextBlockTimestamp]);

  return { arrivedNotificationLength, nonArrivedNotificationLength, arrivals };
};
