import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useComponentValue } from "@dojoengine/react";
import { useUiSounds } from "../useUISound";
import useUIStore from "../store/useUIStore";
import { useEffect, useState } from "react";
import { Subscription } from "rxjs";

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

  const useFoundResources = (realmEntityId: bigint) => {
    const [foundResources, setFoundResources] = useState();

    useEffect(() => {
      const subscribeToDirectOffersEvents = async () => {
        const observable = await exploreEntityMapEvents(realmEntityId);
        const subscription = observable.subscribe((event) => {
          if (event) {
            console.log({ event });
            setFoundResources(event);
          }
        });
        return subscription;
      };
      const sub = subscribeToDirectOffersEvents();

      // Cleanup function
      return () => {
        sub.then((sub) => sub.unsubscribe());
      };
    }, []);

    return foundResources;
  };

  return { isExplored, exploredColsRows, useExplorationClickedHex, useFoundResources };
}
