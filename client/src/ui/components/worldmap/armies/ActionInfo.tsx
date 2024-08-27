import { ClientConfigManager } from "@/dojo/modelManager/ClientConfigManager";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import { FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { BuildingThumbs } from "@/ui/modules/navigation/LeftNavigationModule";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const ActionInfo = () => {
  const { hoveredHex, selectedEntityId, travelPaths } = useUIStore((state) => state.armyActions);
  const { getBalance } = getResourceBalance();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const config = ClientConfigManager.instance();
  const exploreWheatBurn = config.getExploreResourceCost(ResourcesIds.Wheat);
  const exploreFishBurn = config.getExploreResourceCost(ResourcesIds.Fish);
  const exploreReward = config.getExploreReward();

  const travelPath = useMemo(() => {
    if (hoveredHex) return travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex, travelPaths]);

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
                amount={-exploreWheatBurn}
                resourceId={ResourcesIds.Wheat}
                balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
              />
              <ResourceCost
                amount={-exploreFishBurn}
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
                <div>+{exploreReward} Random resource</div>
              </div>
            </div>
          )}
        </BaseThreeTooltip>
      )}
    </>
  );
};
