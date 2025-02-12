import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { configManager, HexTileInfo, ID } from "@bibliothecadao/eternum";
import { useStaminaManager } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo } from "react";

export const StaminaResourceCost = ({
  travelingEntityId,
  isExplored,
  path,
}: {
  travelingEntityId: ID | undefined;
  isExplored: boolean;
  path: HexTileInfo[];
}) => {
  const { currentArmiesTick } = useBlockTimestamp();
  const staminaManager = useStaminaManager(travelingEntityId || 0);

  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const pathInfo = useMemo(() => {
    if (!stamina) return;

    // Calculate total cost and collect biome info
    const totalCost = path.reduce((acc, tile) => {
      return acc + tile.staminaCost;
    }, 0);

    const balanceColor = stamina.amount < totalCost ? "text-order-giants" : "text-order-brilliance";

    return {
      isExplored,
      totalCost,
      balanceColor,
      balance: stamina.amount,
    };
  }, [stamina, path, isExplored]);

  return (
    pathInfo && (
      <div className="flex flex-row p-1 text-xs">
        <div className="text-lg p-1 pr-3">⚡️</div>
        <div className="flex flex-col">
          <div>
            {pathInfo.isExplored ? pathInfo.totalCost : configManager.getExploreStaminaCost()}{" "}
            <span className={clsx(pathInfo.balanceColor, "font-normal")}>({pathInfo.balance})</span>
          </div>
          <div className="text-xs opacity-75">
            {pathInfo.isExplored ? (
              path.map((tile, index) => (
                <div key={index}>
                  {tile.biomeType}: {tile.staminaCost}
                </div>
              ))
            ) : (
              <div>Exploration</div>
            )}
          </div>
        </div>
      </div>
    )
  );
};
