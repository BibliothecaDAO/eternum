import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { GUARD_SLOT_NAMES, GuardSlot, resources, TroopTier, TroopType } from "@bibliothecadao/types";
import { ArrowLeft } from "lucide-react";
import { SLOT_ICON_MAP } from "./slot-icon-map";
import { DefenseTroop } from "./structure-defence";

interface CompactDefenseDisplayProps {
  troops: DefenseTroop[];
  className?: string;
  slotsUsed?: number;
  slotsMax?: number;
}

export const CompactDefenseDisplay = ({ troops, className = "", slotsUsed, slotsMax }: CompactDefenseDisplayProps) => {
  const totalTroopCount = troops.reduce((total, defense) => total + Number(defense.troops.count || 0), 0);
  const baseSlotClasses = "flex items-center gap-1 rounded-md px-1 py-0.5 min-h-[30px] min-w-[96px] transition-colors";
  const hasSlotInfo = slotsUsed !== undefined && slotsMax !== undefined;
  const showHeaderRow = hasSlotInfo || totalTroopCount > 0;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {showHeaderRow && (
        <div className="flex items-center gap-1 flex-wrap">
          {hasSlotInfo && (
            <div className="flex items-center bg-brown-900/80 border border-gold/25 rounded-md px-2 py-0.5 gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gold/70 font-semibold">Slots</span>
              <span className="text-[11px] text-gold font-bold">
                {slotsUsed}/{slotsMax}
              </span>
            </div>
          )}
          {totalTroopCount > 0 && (
            <div className="flex items-center bg-brown-900/90 border border-gold/30 rounded-md px-2 py-0.5 gap-1">
              <span className="text-[10px] uppercase tracking-wide text-gold/70 font-semibold">Total</span>
              <span className="text-[11px] text-gold font-bold">{currencyFormat(totalTroopCount, 0)}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex items-end gap-2 flex-nowrap overflow-x-auto">
        {troops
          .slice()
          .sort((a, b) => a.slot - b.slot)
          .map((defense) => {
            const troopCount = Number(defense.troops.count || 0);
            const rawSlot = Number(defense.slot ?? 0);
            const guardSlotKey = (
              Object.prototype.hasOwnProperty.call(GUARD_SLOT_NAMES, rawSlot) ? rawSlot : rawSlot + 1
            ) as GuardSlot;
            const slotDisplayNumber = guardSlotKey;
            const slotIconSrc = SLOT_ICON_MAP[rawSlot] ?? SLOT_ICON_MAP[guardSlotKey];
            const slotName = GUARD_SLOT_NAMES[guardSlotKey] ?? `Slot ${slotDisplayNumber}`;

            const slotContent =
              troopCount === 0 ? (
                <div
                  className={`${baseSlotClasses} justify-center border border-dashed border-gold/30 bg-brown-900/20 text-[10px] uppercase tracking-wide text-gold/60 font-semibold whitespace-nowrap`}
                  title={`Defense Slot ${slotDisplayNumber} is empty`}
                >
                  <span>Empty Slot</span>
                </div>
              ) : (
                <div
                  className={`${baseSlotClasses} bg-brown-900/90 border border-gold/20 whitespace-nowrap`}
                  title={`Defense Slot ${slotDisplayNumber}`}
                >
                  <span
                    className={`px-1 py-0.5 rounded text-[10px] font-bold border relative ${getTierStyle(defense.troops.tier)}`}
                  >
                    <span className="relative z-10">{defense.troops.tier}</span>
                  </span>
                  <ResourceIcon
                    withTooltip={false}
                    resource={
                      resources.find(
                        (r) =>
                          r.id ===
                          getTroopResourceId(defense.troops.category as TroopType, defense.troops.tier as TroopTier),
                      )?.trait || ""
                    }
                    size="sm"
                  />
                  <span className="text-[10px] text-gold/90 font-medium">{currencyFormat(troopCount, 0)}</span>
                </div>
              );

            return (
              <div key={`${rawSlot}-${guardSlotKey}`} className="flex flex-col items-center gap-1 min-w-[96px]">
                <div className="flex items-center gap-1">
                  {slotIconSrc && (
                    <img src={slotIconSrc} alt={`${slotName} icon`} className="h-8 w-8 object-contain" loading="lazy" />
                  )}
                  <span className="text-[10px] font-semibold text-gold/80">{slotDisplayNumber}</span>
                </div>
                {slotContent}
              </div>
            );
          })}
        <div className="flex flex-col items-center gap-1 min-w-[72px] text-center">
          <span className="text-[10px] uppercase tracking-wide text-gold/70">Incoming</span>
          <div className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center bg-brown-900/50">
            <ArrowLeft className="w-4 h-4 text-gold/80" strokeWidth={2} />
          </div>
          <span className="text-[9px] text-gold/60">Enemy</span>
        </div>
      </div>
    </div>
  );
};
