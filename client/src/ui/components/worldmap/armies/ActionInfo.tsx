import { getResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { BuildingThumbs } from "@/ui/modules/navigation/LeftNavigationModule";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const ActionInfo = () => {
  const hoveredHex = useUIStore((state) => state.armyActions.hoveredHex);
  const selectedEntityId = useUIStore((state) => state.armyActions.selectedEntityId);
  const { getBalance } = getResourceBalance();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const travelPath = useMemo(() => {
    if (hoveredHex)
      return useUIStore
        .getState()
        .armyActions.travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex, useUIStore.getState().armyActions.travelPaths]);

  const showTooltip = useMemo(() => {
    return travelPath !== undefined && travelPath.path.length >= 2 && selectedEntityId !== null;
  }, [hoveredHex, travelPath, selectedEntityId]);

  const isExplored = travelPath?.isExplored || false;

  return (
    <>
      {showTooltip && (
        <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]" visible={showTooltip}>
          <Headline>{isExplored ? "Travel" : "Explore"}</Headline>

          {!isExplored && (
            <div>
              <ResourceCost
                amount={-EternumGlobalConfig.exploration.wheatBurn}
                resourceId={ResourcesIds.Wheat}
                balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
              />
              <ResourceCost
                amount={-EternumGlobalConfig.exploration.fishBurn}
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
        </BaseThreeTooltip>
      )}
    </>
  );
};
