import { RoadInterface } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Entity, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { getRealm, getRealmIdByPosition, getRealmNameById } from "../../ui/utils/realms";
import { getEntityIdFromKeys, getPosition } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useRealmStore from "../store/useRealmStore";

export function useRoads() {
  const {
    setup: {
      components: { Road, Position },
    },
  } = useDojo();

  const getHasRoad = (entityA: bigint | undefined, entityB: bigint | undefined): boolean | undefined => {
    if (entityA && entityB) {
      const positionA = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityA)]));
      const positionB = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityB)]));

      const road1 = getComponentValue(
        Road,
        getEntityIdFromKeys([
          BigInt(positionA?.x || 0),
          BigInt(positionA?.y || 0),
          BigInt(positionB?.x || 0),
          BigInt(positionB?.y || 0),
        ]),
      );

      const road2 = getComponentValue(
        Road,
        getEntityIdFromKeys([
          BigInt(positionB?.x || 0),
          BigInt(positionB?.y || 0),
          BigInt(positionA?.x || 0),
          BigInt(positionA?.y || 0),
        ]),
      );

      const road1Count = road1?.usage_count || 0;
      const road2Count = road2?.usage_count || 0;

      return road1Count > 1 || road2Count > 1;
    } else {
      false;
    }
  };

  return { getHasRoad };
}

export function useGetRoads(entityId: bigint) {
  const {
    setup: {
      components: { Road, Position, Realm },
    },
  } = useDojo();

  const realmId = useRealmStore((state) => state.realmId);

  const [roads, setRoads] = useState<RoadInterface[]>([]);

  const position = useComponentValue(Position, getEntityIdFromKeys([BigInt(entityId)]));

  const entityIds1 = useEntityQuery([
    HasValue(Road, { start_coord_x: position?.x || 0, start_coord_y: position?.y || 0 }),
  ]);

  const entityIds2 = useEntityQuery([HasValue(Road, { end_coord_x: position?.x || 0, end_coord_y: position?.y || 0 })]);

  const entityIds: Entity[] = useMemo(() => {
    return [...entityIds1, ...entityIds2];
  }, [entityIds1, entityIds2]);

  // TODO: put somewhere else for reuse
  const getRealmEntityIdFromRealmId = (realmId: bigint): bigint | undefined => {
    const entityIds = Array.from(runQuery([HasValue(Realm, { realm_id: realmId })]));
    if (entityIds.length > 0) {
      let realm = getComponentValue(Realm, entityIds[0]);
      return realm!.entity_id;
    }
  };

  useEffect(() => {
    let roads: RoadInterface[] = entityIds
      .map((entityId: Entity) => {
        let road = getComponentValue(Road, entityId);
        if (road) {
          // TODO: refactor to just do one query per realm
          let startRealmId = realmId;

          let startRealmName = startRealmId ? getRealmNameById(startRealmId) : "";

          let { order: startRealmOrder } = startRealmId
            ? getRealm(startRealmId) || { order: undefined }
            : { order: undefined };

          let startRealmPosition = getPosition(startRealmId || 0n);

          let destinationRealmId =
            startRealmPosition.x === road.start_coord_x && startRealmPosition.y === road.start_coord_y
              ? getRealmIdByPosition({ x: road.end_coord_x, y: road.end_coord_y })
              : getRealmIdByPosition({ x: road.start_coord_x, y: road.start_coord_y });

          let destinationRealmName = destinationRealmId ? getRealmNameById(BigInt(destinationRealmId)) : "";

          let destinationEntityId = getRealmEntityIdFromRealmId(BigInt(destinationRealmId || 0n)) || 0n;

          let { order: destinationRealmOrder } = destinationRealmId
            ? getRealm(BigInt(destinationRealmId)) || { order: undefined }
            : { order: undefined };

          return {
            startRealmName,
            startRealmOrder,
            startEntityId: entityId,
            destinationEntityId,
            destinationRealmName,
            destinationRealmOrder,
            usageLeft: road.usage_count,
          };
        }
      })
      .filter(Boolean) as RoadInterface[];

    // Group roads by destinationRealmName and keep the one with the highest usageLeft for each destination
    const uniqueRoads = Object.values(
      roads.reduce(
        (acc, road) => {
          if (!acc[road.destinationRealmName] || acc[road.destinationRealmName].usageLeft < road.usageLeft) {
            acc[road.destinationRealmName] = road;
          }
          return acc;
        },
        {} as { [key: string]: RoadInterface },
      ),
    );

    setRoads(uniqueRoads);
  }, [entityIds]);

  return {
    roads,
  };
}
