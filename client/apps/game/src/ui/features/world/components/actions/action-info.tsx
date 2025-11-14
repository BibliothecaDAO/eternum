import { useUIStore } from "@/hooks/store/use-ui-store";
import { FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/design-system/molecules/base-three-tooltip";
import {
  ActionPath,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  getBalance,
  getBlockTimestamp,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useCallback, useMemo } from "react";

import { TooltipContent, type ActionFoodCosts } from "./tooltip-content";

export const ActionInfo = memo(() => {
  const hoveredHex = useUIStore(useCallback((state) => state.entityActions.hoveredHex, []));
  const selectedEntityId = useUIStore(useCallback((state) => state.entityActions.selectedEntityId, []));
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const {
    setup: { components },
  } = useDojo();

  const selectedEntityTroops = useMemo(() => {
    if (!selectedEntityId) return undefined;
    return getComponentValue(components.ExplorerTroops, getEntityIdFromKeys([BigInt(selectedEntityId)]));
  }, [components.ExplorerTroops, selectedEntityId]);

  const actionPath = useMemo<ActionPath[] | undefined>(() => {
    if (!hoveredHex) return undefined;
    return useUIStore
      .getState()
      .entityActions.actionPaths.get(`${hoveredHex.col + FELT_CENTER()},${hoveredHex.row + FELT_CENTER()}`);
  }, [hoveredHex]);

  const showTooltip = useMemo(() => {
    return actionPath !== undefined && actionPath.length >= 2 && selectedEntityId !== null;
  }, [actionPath, selectedEntityId]);

  const isExplored = useMemo(() => {
    if (!actionPath) return false;
    return actionPath[actionPath.length - 1].biomeType !== undefined;
  }, [actionPath]);

  const costs = useMemo<ActionFoodCosts>(() => {
    if (!selectedEntityTroops) {
      return {
        travelFoodCosts: { wheatPayAmount: 0, fishPayAmount: 0 },
        exploreFoodCosts: { wheatPayAmount: 0, fishPayAmount: 0 },
      };
    }

    return {
      travelFoodCosts: computeTravelFoodCosts(selectedEntityTroops.troops),
      exploreFoodCosts: computeExploreFoodCosts(selectedEntityTroops.troops),
    };
  }, [selectedEntityTroops]);

  if (!showTooltip || !selectedEntityId || !actionPath) return null;

  return (
    <BaseThreeTooltip position={Position.CLEAN} className="w-[220px] p-0 shadow-none" visible={showTooltip}>
      <TooltipContent
        isExplored={isExplored}
        actionPath={actionPath}
        costsPerStep={costs}
        selectedEntityId={selectedEntityId}
        structureEntityId={selectedEntityTroops?.owner || 0}
        getBalance={(entityId, resourceId) => getBalance(entityId, resourceId, currentDefaultTick, components)}
      />
    </BaseThreeTooltip>
  );
});
