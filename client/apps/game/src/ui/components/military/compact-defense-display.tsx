import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
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
          key={defense.id}
          className="flex items-center bg-brown-900/90 border border-gold/20 rounded-md px-1.5 py-0.5"
          title={`Defense Slot ${defense.id}`}
        >
          <ResourceIcon withTooltip={false} resource={defense.troops.type} size="xs" className="w-3 h-3" />
          <span className="text-[10px] text-gold/90 font-medium ml-1">
            {currencyFormat(Number(defense.troops.count || 0), 0)}
          </span>
        </div>
      ))}
    </div>
  );
};
