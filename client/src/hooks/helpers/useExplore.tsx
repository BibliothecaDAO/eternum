import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useRef, useState } from "react";
import { Position, Resource, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import useRealmStore from "../store/useRealmStore";
import { findDirection } from "../../ui/utils/utils";
import useUIStore from "../store/useUIStore";
import { Subscription } from "rxjs";

interface ExploreHexProps {
  explorerId: bigint | undefined;
  direction: number | undefined;
  path: Position[];
}

export function useExplore() {
  const {
    setup: {
      components: { Tile },
      updates: {
        eventUpdates: { createExploreEntityMapEvents: exploreEntityMapEvents },
      },
      systemCalls: { explore },
    },
    account: { account },
  } = useDojo();

  const animationPaths = useUIStore((state) => state.animationPaths);
  const setAnimationPaths = useUIStore((state) => state.setAnimationPaths);
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

  const useFoundResources = (entityId: bigint | undefined) => {
    const [foundResources, setFoundResources] = useState<Resource | undefined>();

    const subscriptionRef = useRef<Subscription | undefined>();
    const isComponentMounted = useRef(true);

    useEffect(() => {
      if (!entityId) return;
      const subscribeToFoundResources = async () => {
        const observable = await exploreEntityMapEvents(entityId);
        const subscription = observable.subscribe((event) => {
          if (!isComponentMounted.current) return;
          if (event) {
            const resourceId = Number(event.data[3]);
            const amount = Number(event.data[4]);
            setFoundResources({ resourceId, amount });
          }
        });
        subscriptionRef.current = subscription;
      };
      subscribeToFoundResources();

      // Cleanup function
      return () => {
        isComponentMounted.current = false;
        subscriptionRef.current?.unsubscribe(); // Ensure to unsubscribe on component unmount
      };
    }, [entityId]);

    return { foundResources, setFoundResources };
  };

  const getExplorationInput = (col: number, row: number) => {
    // check if not explored yet
    if (isExplored(col, row)) {
      return;
    }

    const neighborOffsets = row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;

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

  const exploreHex = async ({ explorerId, direction, path }: ExploreHexProps) => {
    if (!explorerId || direction === undefined) return;
    setAnimationPaths([...animationPaths, { id: explorerId, path, enemy: false }]);
    await explore({
      unit_id: explorerId,
      direction,
      signer: account,
    }).catch(() => {
      // revert animation so that it goes back to the original position
      setAnimationPaths([...animationPaths, { id: explorerId, path: path.reverse(), enemy: false }]);
    });
  };
  return { isExplored, exploredColsRows, useFoundResources, getExplorationInput, exploreHex };
}
