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
import { useThreeStore } from "@/hooks/store/useThreeStore";
import { FELT_CENTER } from "@/ui/config";

export const ActionInfo = () => {
  // const travelPaths = useUIStore((state) => state.travelPaths);
  // const selectedEntity = useUIStore((state) => state.selectedEntity);
  // const hoveredHex = useUIStore((state) => state.hoveredHex);
  const hoveredHex = useThreeStore((state) => state.hoveredHex);
  const selectedEntityId = useThreeStore((state) => state.selectedEntityId);
  const travelPaths = useThreeStore((state) => state.travelPaths);
  const { getBalance } = useResourceBalance();
  const { realmEntityId } = useRealmStore();

  const travelPath = useMemo(() => {
    if (!hoveredHex) return null;
    return travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex, travelPaths]);

  const showTooltip = useMemo(() => {
    return hoveredHex && travelPath?.path && selectedEntityId;
  }, [hoveredHex, travelPath, selectedEntityId]);

  console.log({ showTooltip, selectedEntityId, hoveredHex, path: travelPath?.path, travelPaths });

  const isExplored = travelPath?.isExplored || false;

  return (
    <>
      {showTooltip && (
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
            travelingEntityId={BigInt(selectedEntityId)}
            isExplored={isExplored}
            travelLength={travelPath.path.length - 1}
          />
        </BaseThreeTooltip>
      )}
    </>
  );
};
