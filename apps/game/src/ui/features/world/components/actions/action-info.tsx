import { useUIStore } from "@/hooks/store/use-ui-store";
import { FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/design-system/molecules/base-three-tooltip";
import {
  configManager,
  ActionPath,
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  getBalance,
  getBlockTimestamp,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { memo, useCallback, useMemo } from "react";

import { TooltipContent, type ActionFoodCosts } from "./tooltip-content";

export const ActionInfo = memo(() => {
  const hoveredHex = useUIStore(useCallback((state) => state.entityActions.hoveredHex, []));
  const selectedEntityId = useUIStore(useCallback((state) => state.entityActions.selectedEntityId, []));
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const {
    setup: { store },
  } = useGame();

  useNativeRevision(["ResourceBalance", "ResourceProduction", "ResourceWeight"]);
  const selectedEntityTroops = useNativeRow(
    "ExplorerTroops",
    selectedEntityId === null ? undefined : { game_id: configManager.getActiveGameId(), explorer_id: selectedEntityId },
  );

  const actionPath = useMemo<ActionPath[] | undefined>(() => {
    if (!hoveredHex) return undefined;
    return useUIStore
      .getState()
      .entityActions.actionPaths.get(`${hoveredHex.col + FELT_CENTER()},${hoveredHex.row + FELT_CENTER()}`);
  }, [hoveredHex]);

  // A crate explains itself on its own label; every other action gets the cost sheet.
  const showTooltip = useMemo(() => {
    if (actionPath === undefined || actionPath.length < 2 || selectedEntityId === null) return false;
    return ActionPaths.getActionType(actionPath) !== ActionType.Chest;
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
        getBalance={(entityId, resourceId) => getBalance(entityId, resourceId, currentDefaultTick, store)}
      />
    </BaseThreeTooltip>
  );
});
