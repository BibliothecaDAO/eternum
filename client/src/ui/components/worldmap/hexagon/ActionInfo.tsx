import { getResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { ConfigManager, ResourcesIds } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const ActionInfo = () => {
  const explorationCosts = ConfigManager.instance().getConfig().exploration.costs;
  const travelPaths = useUIStore((state) => state.travelPaths);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const hoveredHex = useUIStore((state) => state.hoveredHex);
  const { getBalance } = getResourceBalance();
  const { realmEntityId } = useRealmStore();

  const hoveredHexPosition = useMemo(() => {
    if (!hoveredHex) return { x: 0, y: 0 };
    return getUIPositionFromColRow(hoveredHex.col, hoveredHex.row);
  }, [hoveredHex]);

  const travelPath = useMemo(() => {
    if (!hoveredHex) return null;
    return travelPaths.get(`${hoveredHex.col},${hoveredHex.row}`);
  }, [hoveredHex, travelPaths]);

  const isExplored = travelPath?.isExplored || false;

  return (
    <>
      {hoveredHex && travelPath?.path && selectedEntity && (
        <group position={[hoveredHexPosition.x, 0.32, -hoveredHexPosition.y]}>
          <BaseThreeTooltip position={Position.CENTER} className="-mt-[230px]" distanceFactor={44}>
            <Headline>{isExplored ? "Travel" : "Explore"}</Headline>

            {!isExplored && (
              <div>
                <ResourceCost
                  amount={-explorationCosts[ResourcesIds.Wheat]}
                  resourceId={ResourcesIds.Wheat}
                  balance={getBalance(realmEntityId, ResourcesIds.Wheat).balance}
                />
                <ResourceCost
                  amount={-explorationCosts[ResourcesIds.Fish]}
                  resourceId={ResourcesIds.Fish}
                  balance={getBalance(realmEntityId, ResourcesIds.Fish).balance}
                />
              </div>
            )}
            <StaminaResourceCost
              travelingEntityId={selectedEntity.id}
              isExplored={isExplored}
              travelLength={travelPath.path.length - 1}
            />
          </BaseThreeTooltip>
        </group>
      )}
    </>
  );
};
