import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { useMemo } from "react";
import { Headline } from "@/ui/elements/Headline";
import { TRAVEL_COLOUR } from "./HexLayers";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import { StaminaResourceCost } from "@/ui/elements/StaminaResourceCost";

export const ActionInfo = () => {
  const highlightPath = useUIStore((state) => state.highlightPath);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const { getBalance } = useResourceBalance();
  const { realmEntityId } = useRealmStore();

  const lastHighlightedHex = highlightPath.pos.length > 1 ? highlightPath.pos[highlightPath.pos.length - 1] : undefined;

  const isExplored = useMemo(() => {
    const isExplored = highlightPath.color === TRAVEL_COLOUR;
    return isExplored;
  }, [lastHighlightedHex]);

  return (
    <>
      {lastHighlightedHex && selectedEntity && (
        <group position={[lastHighlightedHex[0], 0.32, lastHighlightedHex[1]]}>
          <BaseThreeTooltip position={Position.TOP_CENTER} distanceFactor={30} className="animate-bounce">
            <Headline>{isExplored ? "Travel" : "Explore"}</Headline>
            <div>Costs</div>
            {!isExplored && (
              <div>
                <ResourceCost
                  amount={EternumGlobalConfig.exploration.wheatBurn}
                  resourceId={ResourcesIds.Wheat}
                  balance={getBalance(realmEntityId, ResourcesIds.Wheat).balance}
                />
                <ResourceCost
                  amount={EternumGlobalConfig.exploration.fishBurn}
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
