import { getResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { useThreeStore } from "@/hooks/store/useThreeStore";
import { FELT_CENTER } from "@/ui/config";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";

export const ActionInfo = () => {
  const { hoveredHex, selectedEntityId, travelPaths } = useThreeStore((state) => state.armyActions);
  const { getBalance } = getResourceBalance();
  const { realmEntityId } = useRealmStore();

  const travelPath = useMemo(() => {
    if (hoveredHex) return travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex, travelPaths]);

  const showTooltip = useMemo(() => {
    return travelPath && travelPath.path.length >= 2 && selectedEntityId !== null;
  }, [hoveredHex, travelPath, selectedEntityId]);

  const isExplored = travelPath?.isExplored || false;

  return (
    <>
      {showTooltip && (
        <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]">
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
            travelingEntityId={BigInt(selectedEntityId!)}
            isExplored={isExplored}
            travelLength={travelPath!.path.length - 1}
          />
        </BaseThreeTooltip>
      )}
    </>
  );
};
