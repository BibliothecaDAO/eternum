import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { resources, TroopTier, TroopType } from "@bibliothecadao/types";
import { DefenseTroop } from "./structure-defence";

interface CompactDefenseDisplayProps {
  troops: DefenseTroop[];
  className?: string;
}

export const CompactDefenseDisplay = ({ troops, className = "" }: CompactDefenseDisplayProps) => {
  return (
    <div className={`flex gap-1 items-center flex-wrap ${className}`}>
      {troops.map((defense) => (
        <div
          key={defense.slot}
          className="flex items-center bg-brown-900/90 border border-gold/20 rounded-md px-1.5 py-0.5"
          title={`Defense Slot ${defense.slot}`}
        >
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold border relative ${getTierStyle(defense.troops.tier)}`}
          >
            <span className="relative z-10">{defense.troops.tier}</span>
          </span>
          <ResourceIcon
            withTooltip={false}
            resource={
              resources.find(
                (r) =>
                  r.id === getTroopResourceId(defense.troops.category as TroopType, defense.troops.tier as TroopTier),
              )?.trait || ""
            }
            size="md"
          />
          <span className="text-[10px] text-gold/90 font-medium ml-1">
            {currencyFormat(Number(defense.troops.count || 0), 0)}
          </span>
        </div>
      ))}
    </div>
  );
};
