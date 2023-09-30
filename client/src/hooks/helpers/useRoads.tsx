import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys, getPosition } from "../../utils/utils";
import { useEffect, useMemo, useState } from "react";
import { EntityIndex, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import useRealmStore from "../store/useRealmStore";
import { getRealm, getRealmIdByPosition, getRealmNameById } from "../../utils/realms";

export interface RoadInterface {
  startRealmName: string;
  startRealmOrder: number | undefined;
  destinationEntityId: number;
  destinationRealmName: string;
  destinationRealmOrder: number | undefined;
  usageLeft: number;
}

export function useRoads() {
  const {
    setup: {
      components: { Road, Position },
    },
  } = useDojo();

  const getHasRoad = (entityA: number | undefined, entityB: number | undefined): boolean | undefined => {
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

export function useGetRoads(entityId: number) {
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

  const entityIds: EntityIndex[] = useMemo(() => {
    return [...entityIds1, ...entityIds2];
  }, [entityIds1, entityIds2]);

  // TODO: put somewhere else for reuse
  const getRealmEntityIdFromRealmId = (realmId: number): number | undefined => {
    const realms = runQuery([HasValue(Realm, { realm_id: realmId })]);
    if (realms.size > 0) {
      return Number(realms.values().next().value);
    }
  };

  useEffect(() => {
    let roads: RoadInterface[] = entityIds
      .map((entityId: EntityIndex) => {
        let road = getComponentValue(Road, entityId);
        if (road) {
          // TODO: refactor to just do one query per realm
          let startRealmId = realmId;
          let startRealmName = startRealmId ? getRealmNameById(startRealmId) : "";
          let { order: startRealmOrder } = startRealmId ? getRealm(startRealmId) : { order: undefined };
          let startRealmPosition = getPosition(startRealmId || 0);
          let destinationRealmId =
            startRealmPosition.x === road.start_coord_x && startRealmPosition.y === road.start_coord_y
              ? getRealmIdByPosition({ x: road.end_coord_x, y: road.end_coord_y })
              : getRealmIdByPosition({ x: road.start_coord_x, y: road.start_coord_y });
          let destinationRealmName = destinationRealmId ? getRealmNameById(destinationRealmId) : "";
          let destinationEntityId = getRealmEntityIdFromRealmId(destinationRealmId || 0) || 0;
          let { order: destinationRealmOrder } = destinationRealmId
            ? getRealm(destinationRealmId)
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
    setRoads(roads);
  }, [entityIds]);

  return {
    roads,
  };
}
