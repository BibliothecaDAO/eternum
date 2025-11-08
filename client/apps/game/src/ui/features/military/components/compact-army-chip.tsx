import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { StaminaResource } from "@/ui/design-system/molecules/stamina-resource";
import { StaminaManager } from "@bibliothecadao/eternum";
import { ArmyInfo, TroopTier, TroopType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { TroopChip } from "./troop-chip";

export const CompactArmyChip = ({ army, className }: { army: ArmyInfo; className?: string }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { currentArmiesTick } = useBlockTimestamp();

  const stamina = useMemo(() => {
    if (!army.troops) return { amount: 0n, updated_tick: 0n };
    return StaminaManager.getStamina(army.troops, currentArmiesTick);
  }, [army.troops, currentArmiesTick]);

  const maxStamina = useMemo(() => {
    if (!army.troops) return 0;
    return StaminaManager.getMaxStamina(army.troops.category as TroopType, army.troops.tier as TroopTier);
  }, [army.troops]);

  const statusEmoji = army.isMine ? "🟢" : "🔴";

  return (
    <div className="flex w-full h-full justify-between gap-2">
      <div className="flex flex-col justify-between w-[55%]">
        <div className="flex flex-col items-start">
          <div
            className="text-xxs mr-1 truncate cursor-default max-w-full"
            onMouseEnter={() =>
              setTooltip({
                content: `Army ID: ${army.entityId}`,
                position: "bottom",
              })
            }
            onMouseLeave={() => setTooltip(null)}
          >
            <span className="mr-0.5">{statusEmoji}</span>
            <span className="truncate">{army.name}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <StaminaResource entityId={army.entityId} stamina={stamina} maxStamina={maxStamina} />
          </div>
        </div>
      </div>
      <div className="flex flex-col w-[45%] gap-1">
        <TroopChip troops={army.troops} className="h-auto" size="sm" />
      </div>
    </div>
  );
};
