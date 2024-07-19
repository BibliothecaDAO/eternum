import { useExploredHexesStore } from "@/ui/components/worldmap/hexagon/WorldHexagon";
import { FELT_CENTER } from "@/ui/config";
import {
  EternumGlobalConfig,
  Position,
  Resource,
  neighborOffsetsEven,
  neighborOffsetsOdd,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { useEffect, useRef, useState } from "react";
import { Subscription } from "rxjs";
import { findDirection } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useRealmStore from "../store/useRealmStore";
import { useStamina } from "./useStamina";

interface ExploreHexProps {
  explorerId: bigint | undefined;
  direction: number | undefined;
  path: Position[];
  currentArmiesTick: number;
}

export function useExplore() {
  const {
    setup: {
      components: { Tile, Position, Stamina },
      updates: {
        eventUpdates: { createExploreEntityMapEvents: exploreEntityMapEvents },
      },
      systemCalls: { explore },
    },
    account: { account },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const setExploredHexes = useExploredHexesStore((state) => state.setExploredHexes);
  const { optimisticStaminaUpdate } = useStamina();

  const removeHex = useExploredHexesStore((state) => state.removeHex);

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

  const optimisticExplore = (entityId: bigint, col: number, row: number, currentArmiesTick: number) => {
    let overrideId = uuid();

    const entity = getEntityIdFromKeys([entityId]);

    optimisticStaminaUpdate(overrideId, entityId, EternumGlobalConfig.stamina.exploreCost, currentArmiesTick);

    Position.addOverride(overrideId, {
      entity,
      value: {
        entity_id: entityId,
        x: col,
        y: row,
      },
    });
    return overrideId;
  };

  const exploreHex = async ({ explorerId, direction, path, currentArmiesTick }: ExploreHexProps) => {
    if (!explorerId || direction === undefined) return;
    setExploredHexes(path[1].x - FELT_CENTER, path[1].y - FELT_CENTER);

    const overrideId = optimisticExplore(explorerId, path[1].x, path[1].y, currentArmiesTick);

    explore({
      unit_id: explorerId,
      direction,
      signer: account,
    }).catch((e) => {
      removeHex(path[1].x - FELT_CENTER, path[1].y - FELT_CENTER);
      Position.removeOverride(overrideId);
      Stamina.removeOverride(overrideId);
    });
  };
  return { isExplored, exploredColsRows, useFoundResources, getExplorationInput, exploreHex };
}
