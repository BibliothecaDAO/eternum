import { ContractAddress, ID, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Entity, Has, HasValue, NotValue, defineQuery, getComponentValue, isComponentUpdate } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDojo } from "../context/DojoContext";
import useNextBlockTimestamp from "../useNextBlockTimestamp";

const DONKEY_RESOURCE_TRACKER = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
const LORDS_RESOURCE_TRACKER = 7237005577332262213973186563042994240829374041602535252466099000494570602496n;
const LORDS_AND_DONKEY_RESOURCE_TRACKER = 7689318425915528602346510723233181380881209919202693705745230188025481265152n;

export type ArrivalInfo = {
  entityId: ID;
  recipientEntityId: ID;
  position: Position;
  arrivesAt: bigint;
  isOwner: boolean;
  hasResources: boolean;
  isHome: boolean;
};

const getCurrentDonkeyWeightMinimum = () => {
  return Number(localStorage.getItem("WEIGHT_MINIMUM") || 0) * 1000;
};

const usePlayerArrivals = () => {
  const {
    account: { account },
    setup: {
      components: { Position, Owner, EntityOwner, OwnedResourcesTracker, ArrivalTime, Weight, Structure },
    },
  } = useDojo();

  const minWeight = getCurrentDonkeyWeightMinimum();

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

  const hasMinWeight = useCallback(
    (entity: Entity) => {
      const weight = getComponentValue(Weight, entity);
      return !!(weight?.value && Number(weight.value) >= minWeight);
    },
    [minWeight],
  );

  const createArrivalInfo = useCallback(
    (id: Entity): ArrivalInfo | undefined => {
      // Get required component values
      const position = getComponentValue(Position, id);
      const arrivalTime = getComponentValue(ArrivalTime, id);
      const ownedResourceTracker = getComponentValue(OwnedResourcesTracker, id);
      const entityOwner = getComponentValue(EntityOwner, id);

      // Return early if missing required components
      if (!position || !arrivalTime) return undefined;

      // Check if entity has special resource types that don't need weight check
      const hasSpecialResources =
        ownedResourceTracker?.resource_types === DONKEY_RESOURCE_TRACKER ||
        ownedResourceTracker?.resource_types === LORDS_RESOURCE_TRACKER ||
        ownedResourceTracker?.resource_types === LORDS_AND_DONKEY_RESOURCE_TRACKER;


      // Determine if entity meets weight requirements
      const meetsWeightRequirement = hasSpecialResources || hasMinWeight(id);

      // Get owner information
      const ownerEntityId = getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]);
      const owner = getComponentValue(Owner, ownerEntityId);
      const isOwner = owner?.address === ContractAddress(account.address);

      // Check if entity has resources
      const hasResources =
        meetsWeightRequirement && !!ownedResourceTracker && ownedResourceTracker.resource_types !== 0n;
      // Find matching player structure at position
      const playerStructurePosition = playerStructurePositions.find(
        (structurePosition) => structurePosition.x === position.x && structurePosition.y === position.y,
      );

      return {
        entityId: position.entity_id,
        recipientEntityId: playerStructurePosition?.entityId || 0,
        arrivesAt: arrivalTime.arrives_at,
        isOwner,
        position: { x: position.x, y: position.y },
        hasResources,
        isHome: !!playerStructurePosition,
      };
    },
    [account, playerStructurePositions],
  );

  const isMine = useCallback(
    (entity: Entity) => {
      const entityOwner = getComponentValue(EntityOwner, entity);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
      return owner?.address === ContractAddress(account.address);
    },
    [account.address],
  );

  useEffect(() => {
    const query = defineQuery(
      [
        Has(Position),
        Has(Weight),
        Has(ArrivalTime),
        Has(EntityOwner),
        NotValue(OwnedResourcesTracker, { resource_types: 0n }),
      ],
      { runOnInit: false },
    );

    const handleArrivalUpdate = (arrivals: ArrivalInfo[], newArrival: ArrivalInfo | undefined) => {
      if (!newArrival) return arrivals;

      if (!newArrival.hasResources || !newArrival.isHome || !newArrival.isOwner) {
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
