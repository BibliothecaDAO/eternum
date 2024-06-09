import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { useMemo } from "react";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { TRAVEL_COLOUR } from "@/ui/config";

export const ActionInfo = () => {
  const highlightPath = useUIStore((state) => state.highlightPath);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const hoveredHex = useUIStore((state) => state.hoveredHex);
  const { getBalance } = useResourceBalance();
  const { realmEntityId } = useRealmStore();

  const hoveredHexPosition = useMemo(() => {
    if (!hoveredHex) return { x: 0, y: 0 };
    return getUIPositionFromColRow(hoveredHex.col, hoveredHex.row);
  }, [hoveredHex]);

  const hoveredHexIsHighlighted = useMemo(() => {
    if (!hoveredHex) return false;
    return highlightPath.pos.some(
      (highlightPos) => highlightPos[0] === hoveredHexPosition.x && highlightPos[1] === -hoveredHexPosition.y,
    );
  }, [hoveredHexPosition]);

  const isExplored = useMemo(() => {
    const isExplored = highlightPath.color === TRAVEL_COLOUR;
    return isExplored;
  }, [hoveredHexPosition]);

  return (
    <>
      {hoveredHexIsHighlighted && selectedEntity && (
        <group position={[hoveredHexPosition.x, 0.32, -hoveredHexPosition.y]}>
          <BaseThreeTooltip position={Position.CENTER} className="-mt-[230px]" distanceFactor={44}>
            <Headline>{isExplored ? "Travel" : "Explore"}</Headline>

            {!isExplored && (
              <div>
                <ResourceCost
                  amount={-EternumGlobalConfig.exploration.wheatBurn}
                  resourceId={ResourcesIds.Wheat}
                  balance={getBalance(realmEntityId, ResourcesIds.Wheat).balance}
                />
                <ResourceCost
                  amount={-EternumGlobalConfig.exploration.fishBurn}
                  resourceId={ResourcesIds.Fish}
                  balance={getBalance(realmEntityId, ResourcesIds.Fish).balance}
                />
              </div>
            )}
            <StaminaResourceCost
              travelingEntityId={selectedEntity.id}
              isExplored={isExplored}
              travelLength={highlightPath.pos.length - 1}
            />
          </BaseThreeTooltip>
        </group>
      )}
    </>
  );
};
