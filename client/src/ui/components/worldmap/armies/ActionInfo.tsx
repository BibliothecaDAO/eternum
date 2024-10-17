import { useDojo } from "@/hooks/context/DojoContext";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { computeExploreFoodCosts, computeTravelFoodCosts } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

export const ActionInfo = () => {
  const hoveredHex = useUIStore((state) => state.armyActions.hoveredHex);
  const selectedEntityId = useUIStore((state) => state.armyActions.selectedEntityId);
  const { getBalance } = getResourceBalance();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const {
    setup: {
      components: { Army },
    },
  } = useDojo();

  const selectedEntityTroops = useMemo(() => {
    if (selectedEntityId) {
      const army = getComponentValue(Army, getEntityIdFromKeys([BigInt(selectedEntityId)]));
      return army?.troops;
    }
    return {
      knight_count: 0n,
      paladin_count: 0n,
      crossbowman_count: 0n,
    };
  }, [selectedEntityId]);

  const travelPath = useMemo(() => {
    if (hoveredHex) {
      return useUIStore
        .getState()
        .armyActions.travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
    }
  }, [hoveredHex, useUIStore.getState().armyActions.travelPaths]);

  const showTooltip = useMemo(() => {
    return travelPath !== undefined && travelPath.path.length >= 2 && selectedEntityId !== null;
  }, [hoveredHex, travelPath, selectedEntityId]);

  const isExplored = travelPath?.isExplored || false;

  const travelFoodCosts = computeTravelFoodCosts(selectedEntityTroops);
  const exploreFoodCosts = computeExploreFoodCosts(selectedEntityTroops);

  return (
    <>
      {selectedEntityId && (
        <div className="text-xs fixed top-0 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white text-center py-2 z-50 w-[300px] top-[60px] rounded-lg animate-pulse pointer-events-none">
          Press Esc to exit travel mode
        </div>
      )}
      {showTooltip && (
        <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]" visible={showTooltip}>
          <Headline>{isExplored ? "Travel" : "Explore"}</Headline>

          {isExplored ? (
            <div>
              <ResourceCost
                amount={-travelFoodCosts.wheatPayAmount * (travelPath!.path.length - 1)}
                resourceId={ResourcesIds.Wheat}
                balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
              />
              <ResourceCost
                amount={-travelFoodCosts.fishPayAmount * (travelPath!.path.length - 1)}
                resourceId={ResourcesIds.Fish}
                balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
              />
            </div>
          ) : (
            <div>
              <ResourceCost
                amount={-exploreFoodCosts.wheatPayAmount}
                resourceId={ResourcesIds.Wheat}
                balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
              />
              <ResourceCost
                amount={-exploreFoodCosts.fishPayAmount}
                resourceId={ResourcesIds.Fish}
                balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
              />
            </div>
          )}
          <StaminaResourceCost
            travelingEntityId={selectedEntityId!}
            isExplored={isExplored}
            travelLength={travelPath!.path.length - 1}
          />
          {!isExplored && (
            <div className="flex flex-row text-xs ml-1">
              <img src={BuildingThumbs.resources} className="w-6 h-6 self-center" />
              <div className="flex flex-col p-1 text-xs">
                <div>+{EternumGlobalConfig.exploration.reward} Random resource</div>
              </div>
            </div>
          )}
          <div className="text-xs text-center mt-2 text-gray-400 animate-pulse">Right-click to confirm</div>
        </BaseThreeTooltip>
      )}
    </>
  );
};
