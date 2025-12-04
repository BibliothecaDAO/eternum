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

  return (
    <div className={`flex w-full flex-col gap-1 ${className ?? ""}`}>
      <div
        className="text-xxs mr-1 truncate cursor-default max-w-full text-gold/80"
        onMouseEnter={() =>
          setTooltip({
            content: `Army ID: ${army.entityId}`,
            position: "bottom",
          })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        <span className="truncate">{army.name}</span>
      </div>
      <TroopChip troops={army.troops} className="h-auto w-full" size="sm" />
      <div className="flex flex-col items-start gap-0.5 w-full">
        <span className="text-[10px] uppercase tracking-[0.2em] text-gold/60">Stamina</span>
        <StaminaResource entityId={army.entityId} stamina={stamina} maxStamina={maxStamina} className="w-full" />
      </div>
    </div>
  );
};
