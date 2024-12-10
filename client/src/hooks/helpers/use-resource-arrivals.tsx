import { configManager } from "@/dojo/setup";
import { ContractAddress, ID, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Entity, Has, HasValue, defineQuery, getComponentValue, isComponentUpdate, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";

export type ArrivalInfo = {
  entityId: ID;
  position: Position;
  arrivesAt: bigint;
  isOwner: boolean;
  hasResources: boolean;
  isHome: boolean;
};

const usePlayerArrivals = () => {
  const {
    account: { account },
    setup: {
      components: { Position, Owner, EntityOwner, ArrivalTime, Weight, Resource, Structure },
    },
  } = useDojo();

  const weightLessResources = useMemo(() => {
    return configManager.getWeightLessResources();
  }, []);

  // needed to query without playerStructures() from useEntities because of circular dependency
  const playerStructures = useEntityQuery([
    Has(Structure),
    HasValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  useEffect(() => {
    const positions = playerStructures.map((entityId) => {
      const position = getComponentValue(Position, entityId);
      return { x: position?.x ?? 0, y: position?.y ?? 0 };
    });
    setPlayerStructurePositions(positions);
  }, [playerStructures, Position]);

  const [playerStructurePositions, setPlayerStructurePositions] = useState<Position[]>([]);

  const [entitiesWithInventory, setEntitiesWithInventory] = useState<ArrivalInfo[]>([]);

  const queryFragments = [Has(Weight), Has(ArrivalTime)];

  const getArrivalsWithResourceOnPosition = useCallback((positions: Position[]) => {
    return positions.flatMap((position) => {
      return Array.from(runQuery([HasValue(Position, { x: position.x, y: position.y }), ...queryFragments]));
    });
  }, []);

  const createArrivalInfo = useCallback(
    (id: Entity): ArrivalInfo | undefined => {
      const arrivalTime = getComponentValue(ArrivalTime, id);
      const entityOwner = getComponentValue(EntityOwner, id);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
      const position = getComponentValue(Position, id);

      const hasWeightlessResources = weightLessResources.some(
        (resourceId) =>
          (getComponentValue(Resource, getEntityIdFromKeys([BigInt(position!.entity_id), BigInt(resourceId)]))
            ?.balance ?? 0n) > 0n,
      );

      const hasResources = hasWeightlessResources || getComponentValue(Weight, id)?.value !== 0n || false;

      const isHome = playerStructurePositions.some(
        (structurePosition) => structurePosition.x === position?.x && structurePosition.y === position?.y,
      );

      if (!arrivalTime || !position || owner?.address !== ContractAddress(account.address)) {
        return undefined;
      }

      return {
        entityId: position.entity_id,
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
      .filter((arrival: any): arrival is ArrivalInfo => arrival !== undefined)
      .filter((arrival) => arrival.hasResources);
    setEntitiesWithInventory(arrivals);
  }, [playerStructurePositions, getArrivalsWithResourceOnPosition, createArrivalInfo]);

  const isMine = (entity: Entity) => {
    const entityOwner = getComponentValue(EntityOwner, entity);
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
    return owner?.address === ContractAddress(account.address);
  };

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
      if (isComponentUpdate(update, Position) || isComponentUpdate(update, Weight)) {
        const isThisMine = isMine(update.entity);
        isThisMine &&
          setEntitiesWithInventory((arrivals) => handleArrivalUpdate(arrivals, createArrivalInfo(update.entity)));
      }
    });

    return () => sub.unsubscribe();
  }, [account, playerStructurePositions, createArrivalInfo, isMine]);

  const structurePositions = useMemo(
    () => new Set(playerStructurePositions.map((position) => `${position.x},${position.y}`)),
    [playerStructurePositions],
  );

  return useMemo(
    () => entitiesWithInventory.sort((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt)),
    [entitiesWithInventory, structurePositions],
  );
};

export const usePlayerArrivalsNotificationLength = () => {
  const [notificationLength, setNotificationLength] = useState(0);

  const arrivals = usePlayerArrivals();

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  useEffect(() => {
    const updateNotificationLength = () => {
      const arrivedCount = arrivals.filter(
        (arrival) => Number(arrival.arrivesAt) <= (nextBlockTimestamp || 0) && arrival.hasResources,
      ).length;
      setNotificationLength(arrivedCount);
    };

    updateNotificationLength();

    const intervalId = setInterval(updateNotificationLength, 10000);

    return () => clearInterval(intervalId);
  }, [arrivals, nextBlockTimestamp]);

  return { notificationLength, arrivals };
};
