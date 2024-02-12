import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useComponentValue } from "@dojoengine/react";
import { useUiSounds } from "../useUISound";
import useUIStore from "../store/useUIStore";
import { useEffect, useState } from "react";
import { Subscription } from "rxjs";
import { Resource } from "@bibliothecadao/eternum";
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

  const clickedHex = useUIStore((state) => state.clickedHex);
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

    let isSubscribed = true; // flag to handle async state updates

    useEffect(() => {
      if (!realmEntityId) return;
      const subscribeToFoundResources = async () => {
        const observable = await exploreEntityMapEvents(realmEntityId);
        const subscription = observable.subscribe((event) => {
          if (event && isSubscribed) {
            const resourceId = Number(event.data[1]);
            const amount = Number(event.data[2]);
            setFoundResources({ resourceId, amount });
          }
        });
        return subscription;
      };
      const sub = subscribeToFoundResources();

      // Cleanup function
      return () => {
        isSubscribed = false; // prevent state update on unmounted component
        sub.then((sub) => {
          sub.unsubscribe();
        });
      };
    }, [realmEntityId]);

    return foundResources;
  };

  const getExplorationInput = (col: number, row: number) => {
    // check if not explored yet
    if (isExplored(col, row)) {
      return;
    }

    // if even
    const neighborOffsets = [
      { i: 1, j: 0, direction: 0 },
      { i: 0, j: -1, direction: 1 },
      { i: -1, j: -1, direction: 2 },
      { i: -1, j: 0, direction: 3 },
      { i: -1, j: 1, direction: 4 },
      { i: 0, j: 1, direction: 5 },
    ];

    // if odd
    // const neighborOffsets = [
    //   { i: 1, j: 0, direction: 0 },
    //   { i: 1, j: -1, direction: 1 },
    //   { i: 0, j: -1, direction: 2 },
    //   { i: -1, j: 0, direction: 3 },
    //   { i: 0, j: 1, direction: 4 },
    //   { i: 1, j: 1, direction: 5 },
    // ];

    // check if the neighbor hexes have been explored by the same player
    for (let offset of neighborOffsets) {
      let exploration = getComponentValue(Tile, getEntityIdFromKeys([BigInt(col + offset.i), BigInt(row + offset.j)]));
      if (
        exploration &&
        realmEntityIds.some((realmEntity) => (exploration?.explored_by_id || 0) === realmEntity.realmEntityId)
      ) {
        return { exploration, direction: offset.direction };
      }
    }
  };

  return { isExplored, exploredColsRows, useFoundResources, getExplorationInput };
}
