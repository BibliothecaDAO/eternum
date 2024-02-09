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
      components: { ExploredMap },
      updates: {
        eventUpdates: { exploreEntityMapEvents },
      },
    },
  } = useDojo();

  const clickedHex = useUIStore((state) => state.clickedHex);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const isExplored = (col: number, row: number) => {
    const exploredMap = getComponentValue(ExploredMap, getEntityIdFromKeys([BigInt(col), BigInt(row)]));

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

  // add a custom event
  const useExplorationClickedHex = () => {
    const exploredColsRows = useComponentValue(
      ExploredMap,
      getEntityIdFromKeys([BigInt(clickedHex.col), BigInt(clickedHex.row)]),
    );

    if (exploredColsRows) {
    }

    return exploredColsRows;
  };

  const useFoundResources = (realmEntityId: bigint | undefined) => {
    const [foundResources, setFoundResources] = useState<Resource | undefined>();

    useEffect(() => {
      if (!realmEntityId) return;
      const subscribeToDirectOffersEvents = async () => {
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
      const sub = subscribeToDirectOffersEvents();

      // Cleanup function
      return () => {
        sub.then((sub) => sub.unsubscribe());
      };
    }, [realmEntityId]);

    return foundResources;
  };

  const isValidExplore = (col: number, row: number) => {
    // check if not explored yet
    if (isExplored(col, row)) {
      console.log("already explored");
      return false;
    }

    const neighborOffsets = [
      { i: 1, j: 0 },
      { i: -1, j: -1 },
      { i: 0, j: -1 },
      { i: -1, j: 0 },
      { i: -1, j: 1 },
      { i: 0, j: 1 },
    ];

    // check if the neighbor hexes have been explored by the same player
    for (let offset of neighborOffsets) {
      let exploration = getComponentValue(
        ExploredMap,
        getEntityIdFromKeys([BigInt(col + offset.i), BigInt(row + offset.j)]),
      );
      console.log({ exploration });
      if (exploration && exploration.explored_by_id === realmEntityIds[0]?.realmEntityId) {
        console.log("has neighbor explored", exploration);
        return true;
      }
    }
  };

  return { isExplored, exploredColsRows, useExplorationClickedHex, useFoundResources, isValidExplore };
}
