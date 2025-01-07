import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { computeExploreFoodCosts, computeTravelFoodCosts } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useCallback, useMemo } from "react";

const TooltipContent = memo(
  ({
    isExplored,
    travelPath,
    costs,
    selectedEntityId,
    structureEntityId,
    getBalance,
  }: {
    isExplored: boolean;
    travelPath: any;
    costs: { travelFoodCosts: any; exploreFoodCosts: any };
    selectedEntityId: string;
    structureEntityId: string;
    getBalance: any;
  }) => (
    <>
      <Headline>{isExplored ? "Travel" : "Explore"}</Headline>
      {isExplored ? (
        <div>
          <ResourceCost
            amount={-costs.travelFoodCosts.wheatPayAmount * (travelPath.path.length - 1)}
            resourceId={ResourcesIds.Wheat}
            balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
          />
          <ResourceCost
            amount={-costs.travelFoodCosts.fishPayAmount * (travelPath.path.length - 1)}
            resourceId={ResourcesIds.Fish}
            balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
          />
        </div>
      ) : (
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
      )}
      <StaminaResourceCost
        travelingEntityId={Number(selectedEntityId)}
        isExplored={isExplored}
        travelLength={travelPath.path.length - 1}
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
  ),
);

TooltipContent.displayName = "TooltipContent";

export const ActionInfo = memo(() => {
  const hoveredHex = useUIStore(useCallback((state) => state.armyActions.hoveredHex, []));
  const selectedEntityId = useUIStore(useCallback((state) => state.armyActions.selectedEntityId, []));
  const structureEntityId = useUIStore(useCallback((state) => state.structureEntityId, []));

  const { getBalance } = useResourceBalance();
  const {
    setup: {
      components: { Army },
    },
  } = useDojo();

  const selectedEntityTroops = useMemo(() => {
    if (!selectedEntityId) {
      return {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      };
    }
    const army = getComponentValue(Army, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    return (
      army?.troops || {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      }
    );
  }, [selectedEntityId, Army]);

  const travelPath = useMemo(() => {
    if (!hoveredHex) return undefined;
    return useUIStore
      .getState()
      .armyActions.travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex]);

  const showTooltip = useMemo(() => {
    return travelPath !== undefined && travelPath.path.length >= 2 && selectedEntityId !== null;
  }, [travelPath, selectedEntityId]);

  const isExplored = travelPath?.isExplored || false;

  const costs = useMemo(
    () => ({
      travelFoodCosts: computeTravelFoodCosts(selectedEntityTroops),
      exploreFoodCosts: computeExploreFoodCosts(selectedEntityTroops),
    }),
    [selectedEntityTroops],
  );

  if (!showTooltip) return null;

  return (
    <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]" visible={showTooltip}>
      <TooltipContent
        isExplored={isExplored}
        travelPath={travelPath}
        costs={costs}
        selectedEntityId={selectedEntityId!.toString()}
        structureEntityId={structureEntityId.toString()}
        getBalance={getBalance}
      />
    </BaseThreeTooltip>
  );
});

ActionInfo.displayName = "ActionInfo";
