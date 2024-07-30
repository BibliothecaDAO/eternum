import { getResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";
import { FELT_CENTER } from "@/ui/config";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import useUIStore from "@/hooks/store/useUIStore";

export const ActionInfo = () => {
  const { hoveredHex, selectedEntityId, travelPaths } = useUIStore((state) => state.armyActions);
  const { getBalance } = getResourceBalance();
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const travelPath = useMemo(() => {
    if (hoveredHex) return travelPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex, travelPaths]);

  const showTooltip = useMemo(() => {
    return travelPath !== undefined && travelPath.path.length >= 2 && selectedEntityId !== null;
  }, [hoveredHex, travelPath, selectedEntityId]);

  const isExplored = travelPath?.isExplored || false;

  return (
    <>
      <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]" visible={showTooltip}>
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
        {showTooltip && (
          <StaminaResourceCost
            travelingEntityId={BigInt(selectedEntityId!)}
            isExplored={isExplored}
            travelLength={travelPath!.path.length - 1}
          />
        )}
      </BaseThreeTooltip>
    </>
  );
};
