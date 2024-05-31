import { useStamina } from "@/hooks/helpers/useStamina";
import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { FELT_CENTER, useExploredHexesStore } from "./WorldHexagon";
import { useMemo } from "react";
import { Headline } from "@/ui/elements/Headline";
import { getColRowFromUIPosition } from "@/ui/utils/utils";
import { TRAVEL_COLOUR } from "./HexLayers";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useResourceBalance, useResources } from "@/hooks/helpers/useResources";
import useRealmStore from "@/hooks/store/useRealmStore";
import clsx from "clsx";

export const ActionInfo = () => {
  const highlightPath = useUIStore((state) => state.highlightPath);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const { getBalance } = useResourceBalance();
  const { realmEntityId } = useRealmStore();
  const { useStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: selectedEntity?.id || 0n });

  const lastHighlightedHex = highlightPath.pos.length > 1 ? highlightPath.pos[highlightPath.pos.length - 1] : undefined;

  const destinationHex = useMemo(() => {
    if (!lastHighlightedHex || !stamina) return;
    const isExplored = highlightPath.color === TRAVEL_COLOUR;
    const costs =
      (highlightPath.pos.length - 1) *
      (isExplored ? EternumGlobalConfig.stamina.travelCost : EternumGlobalConfig.stamina.exploreCost);

    const balanceColor = stamina !== undefined && stamina.amount < costs ? "text-red/90" : "text-green/90";

    return { isExplored, costs, balanceColor, balance: stamina.amount };
  }, [lastHighlightedHex, stamina]);

  return (
    <>
      {lastHighlightedHex && destinationHex && (
        <group position={[lastHighlightedHex[0], 0.32, lastHighlightedHex[1]]}>
          <BaseThreeTooltip position={Position.TOP_CENTER} distanceFactor={30} className="animate-bounce">
            <Headline>{destinationHex.isExplored ? "Travel" : "Explore"}</Headline>
            <div>Costs</div>
            {!destinationHex.isExplored && (
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
            <div className="flex flex-row p-1 text-xs">
              <div className="text-lg p-1 pr-3">⚡️</div>
              <div className="flex flex-col">
                <div>
                  {destinationHex.costs}{" "}
                  <span className={clsx(destinationHex.balanceColor, "font-normal")}>({destinationHex.balance})</span>
                </div>
                <div>Stamina</div>
              </div>
            </div>
          </BaseThreeTooltip>
        </group>
      )}
    </>
  );
};
