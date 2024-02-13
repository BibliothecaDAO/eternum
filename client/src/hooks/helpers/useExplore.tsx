import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useRef, useState } from "react";
import { Resource, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import useRealmStore from "../store/useRealmStore";

export function useExplore() {
  const {
    setup: {
      components: { Tile },
      updates: {
        eventUpdates: { exploreEntityMapEvents },
      },
    },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const isExplored = (col: number, row: number) => {
    const exploredMap = getComponentValue(Tile, getEntityIdFromKeys([BigInt(col), BigInt(row)]));

    return exploredMap ? true : false;
  };

  const exploredColsRows = (
    startCol: number,
    endCol: number,
    startRow: number,
    endRow: number,
  ): { col: number; row: number }[] => {
    let explored = [];
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        if (isExplored(col, row)) {
          explored.push({ col, row });
        }
      }
    }
    return explored;
  };

  const useFoundResources = (realmEntityId: bigint | undefined) => {
    const [foundResources, setFoundResources] = useState<Resource | undefined>();

    const subscriptionRef = useRef(null);

    useEffect(() => {
      if (!realmEntityId) return;
      const subscribeToFoundResources = async () => {
        const observable = await exploreEntityMapEvents(realmEntityId);
        const subscription = observable.subscribe((event) => {
          if (event) {
            const resourceId = Number(event.data[1]);
            const amount = Number(event.data[2]);
            setFoundResources({ resourceId, amount });
          }
        });
        return subscription;
      };
      subscribeToFoundResources();

      // Cleanup function
      return () => {
        if (subscriptionRef.current) {
          // @ts-ignore
          subscriptionRef.current.unsubscribe();
        }
      };
    }, [realmEntityId]);

    return foundResources;
  };

  const getExplorationInput = (col: number, row: number) => {
    // check if not explored yet
    if (isExplored(col, row)) {
      return;
    }

    const neighborOffsets = row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;

    const findDirection = (startPos: { col: number; row: number }, endPos: { col: number; row: number }) => {
      // give the direction
      const neighborOffsets = startPos.row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;
      for (let offset of neighborOffsets) {
        if (startPos.col + offset.i === endPos.col && startPos.row + offset.j === endPos.row) {
          return offset.direction;
        }
      }
    };

    // check if the neighbor hexes have been explored by the same player
    for (let offset of neighborOffsets) {
      let exploration = getComponentValue(Tile, getEntityIdFromKeys([BigInt(col + offset.i), BigInt(row + offset.j)]));
      if (
        exploration &&
        realmEntityIds.some((realmEntity) => (exploration?.explored_by_id || 0) === realmEntity.realmEntityId)
      ) {
        return {
          exploration,
          direction: findDirection({ col: Number(exploration.col), row: Number(exploration.row) }, { col, row }),
        };
      }
    }
  };

  return { isExplored, exploredColsRows, useFoundResources, getExplorationInput };
}
