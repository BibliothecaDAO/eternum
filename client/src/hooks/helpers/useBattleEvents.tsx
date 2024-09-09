import { BattleSide, ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context/DojoContext";

export const useBattleStart = (battleEntityId: ID) => {
  const {
    setup: {
      components: {
        events: { BattleStartData },
      },
    },
  } = useDojo();

  const battleStartDataEntityIds = useEntityQuery(
    [
      HasValue(BattleStartData, {
        battle_entity_id: battleEntityId,
      }),
    ],
    {
      updateOnValueChange: false,
    },
  );

  const battleStartData = useMemo(() => {
    return battleStartDataEntityIds.map((entityId) => {
      const battleStartData = getComponentValue(BattleStartData, entityId);
      return battleStartData;
    });
  }, [battleStartDataEntityIds]);

  return battleStartData;
};

export const useBattleJoin = (battleEntityId: ID, joinerSide?: BattleSide) => {
  const {
    setup: {
      components: {
        events: { BattleJoinData },
      },
    },
  } = useDojo();

  const battleStartDataEntityIds = useEntityQuery(
    [
      HasValue(BattleJoinData, {
        battle_entity_id: battleEntityId,
        ...(joinerSide ? { joiner_side: BattleSide[joinerSide] } : {}),
      }),
    ],
    {
      updateOnValueChange: false,
    },
  );

  const battleStartData = useMemo(() => {
    return battleStartDataEntityIds.map((entityId) => {
      const battleJoinData = getComponentValue(BattleJoinData, entityId);
      return battleJoinData;
    });
  }, [battleStartDataEntityIds]);

  return battleStartData;
};
export const useBattleLeave = (battleEntityId: ID, leaverSide?: BattleSide) => {
  const {
    setup: {
      components: {
        events: { BattleLeaveData },
      },
    },
  } = useDojo();

  const battleLeaveDataEntityIds = useEntityQuery(
    [
      HasValue(BattleLeaveData, {
        battle_entity_id: battleEntityId,
        ...(leaverSide ? { leaver_side: BattleSide[leaverSide] } : {}),
      }),
    ],
    {
      updateOnValueChange: false,
    },
  );

  const battleLeaveData = useMemo(() => {
    return battleLeaveDataEntityIds.map((entityId) => {
      const battleLeaveData = getComponentValue(BattleLeaveData, entityId);
      return battleLeaveData;
    });
  }, [battleLeaveDataEntityIds]);

  return battleLeaveData;
};
