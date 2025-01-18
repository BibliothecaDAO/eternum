import { useDojo } from "@/hooks/context/dojo-context";
import { BattleSide, ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, getComponentValue, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";

const useBattleEventData = (
  eventComponent: Component,
  battleEntityId: ID,
  sideFilter?: { key: string; side: BattleSide },
) => {
  const eventEntityIds = useEntityQuery(
    [
      HasValue(eventComponent, {
        battle_entity_id: battleEntityId,
        ...(sideFilter ? { [sideFilter.key]: BattleSide[sideFilter.side] } : {}),
      }),
    ],
    {
      updateOnValueChange: false,
    },
  );

  return useMemo(() => {
    return eventEntityIds.map((entityId) => getComponentValue(eventComponent, entityId));
  }, [eventEntityIds]);
};

export const useBattleStart = (battleEntityId: ID) => {
  const {
    setup: {
      components: {
        events: { BattleStartData },
      },
    },
  } = useDojo();

  return useBattleEventData(BattleStartData, battleEntityId);
};

export const useBattleJoin = (battleEntityId: ID, joinerSide?: BattleSide) => {
  const {
    setup: {
      components: {
        events: { BattleJoinData },
      },
    },
  } = useDojo();

  return useBattleEventData(
    BattleJoinData,
    battleEntityId,
    joinerSide ? { key: "joiner_side", side: joinerSide } : undefined,
  );
};

export const useBattleLeave = (battleEntityId: ID, leaverSide?: BattleSide) => {
  const {
    setup: {
      components: {
        events: { BattleLeaveData },
      },
    },
  } = useDojo();

  return useBattleEventData(
    BattleLeaveData,
    battleEntityId,
    leaverSide ? { key: "leaver_side", side: leaverSide } : undefined,
  );
};
