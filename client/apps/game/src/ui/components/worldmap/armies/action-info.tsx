import { useUIStore } from "@/hooks/store/use-ui-store";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { StaminaResourceCost } from "@/ui/elements/stamina-resource-cost";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  getBalance,
  ID,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useCallback, useMemo } from "react";

const TooltipContent = memo(
  ({
    isExplored,
    actionPath,
    costs,
    selectedEntityId,
    structureEntityId,
    getBalance,
  }: {
    isExplored: boolean;
    actionPath: ActionPath[];
    costs: { travelFoodCosts: any; exploreFoodCosts: any };
    selectedEntityId: number;
    structureEntityId: number;
    getBalance: (entityId: ID, resourceId: ResourcesIds) => { balance: number; resourceId: ResourcesIds };
  }) => {
    const actionType = ActionPaths.getActionType(actionPath);

    return (
      <>
        <Headline>{actionType}</Headline>
        {actionType === ActionType.Explore ? (
          <div>
            <ResourceCost
              amount={-costs.travelFoodCosts.wheatPayAmount * (actionPath.length - 1)}
              resourceId={ResourcesIds.Wheat}
              balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
            />
            <ResourceCost
              amount={-costs.travelFoodCosts.fishPayAmount * (actionPath.length - 1)}
              resourceId={ResourcesIds.Fish}
              balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
            />
          </div>
        ) : actionType === ActionType.Move ? (
          <div>
            <ResourceCost
              amount={-costs.exploreFoodCosts.wheatPayAmount}
              resourceId={ResourcesIds.Wheat}
              balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
            />
            <ResourceCost
              amount={-costs.exploreFoodCosts.fishPayAmount}
              resourceId={ResourcesIds.Fish}
              balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
            />
          </div>
        ) : null}
        <StaminaResourceCost
          travelingEntityId={Number(selectedEntityId)}
          isExplored={isExplored}
          path={actionPath.slice(1)}
        />
        {!isExplored && (
          <div className="flex flex-row text-xs ml-1">
            <img src={BuildingThumbs.resources} className="w-6 h-6 self-center" />
            <div className="flex flex-col p-1 text-xs">
              <div>+{configManager.getExploreReward()} Random resource</div>
            </div>
          </div>
        )}
        <div className="text-xs text-center mt-2 text-gray-400 animate-pulse">Right-click to confirm</div>
      </>
    );
  },
);

TooltipContent.displayName = "TooltipContent";

export const ActionInfo = memo(() => {
  const hoveredHex = useUIStore(useCallback((state) => state.armyActions.hoveredHex, []));
  const selectedEntityId = useUIStore(useCallback((state) => state.armyActions.selectedEntityId, []));
  const structureEntityId = useUIStore(useCallback((state) => state.structureEntityId, []));
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const {
    setup: { components },
  } = useDojo();

  const selectedEntityTroops = useMemo(() => {
    if (!selectedEntityId) {
      return {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      };
    }
    const army = getComponentValue(components.Army, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    return (
      army?.troops || {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      }
    );
  }, [selectedEntityId]);

  const actionPath = useMemo(() => {
    if (!hoveredHex) return undefined;
    return useUIStore
      .getState()
      .armyActions.actionPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex]);

  const showTooltip = useMemo(() => {
    return actionPath !== undefined && actionPath.length >= 2 && selectedEntityId !== null;
  }, [actionPath, selectedEntityId]);

  const isExplored = useMemo(() => {
    return actionPath?.[actionPath.length - 1].biomeType !== undefined;
  }, [actionPath]);

  const costs = useMemo(
    () => ({
      travelFoodCosts: computeTravelFoodCosts(selectedEntityTroops),
      exploreFoodCosts: computeExploreFoodCosts(selectedEntityTroops),
    }),
    [selectedEntityTroops],
  );

  if (!showTooltip || !selectedEntityId || !actionPath) return null;

  return (
    <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]" visible={showTooltip}>
      <TooltipContent
        isExplored={isExplored}
        actionPath={actionPath}
        costs={costs}
        selectedEntityId={selectedEntityId}
        structureEntityId={structureEntityId}
        getBalance={(entityId: ID, resourceId: ResourcesIds) =>
          getBalance(entityId, resourceId, currentDefaultTick, components)
        }
      />
    </BaseThreeTooltip>
  );
});

ActionInfo.displayName = "ActionInfo";
