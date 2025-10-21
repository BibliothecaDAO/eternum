import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { DEFENSE_NAMES, resources, TroopTier } from "@bibliothecadao/types";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";

import type { GuardSummary, SelectedTroopCombo } from "./types";

interface DefenseSlotSelectionProps {
  guardSlot: number;
  maxDefenseSlots: number;
  guardsBySlot: Map<number, GuardSummary>;
  selectedTroopCombo: SelectedTroopCombo;
  canCreateDefenseArmy: boolean;
  defenseSlotInfoMessage: string | null;
  defenseSlotErrorMessage: string | null;
  onSelect: (slot: number) => void;
}

export const DefenseSlotSelection = ({
  guardSlot,
  maxDefenseSlots,
  guardsBySlot,
  selectedTroopCombo,
  canCreateDefenseArmy,
  defenseSlotInfoMessage,
  defenseSlotErrorMessage,
  onSelect,
}: DefenseSlotSelectionProps) => {
  return (
    <div className="flex-1 p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
      <div className="text-center mb-4">
        <h6 className="text-gold text-lg font-bold mb-1">DEFENSE SLOT</h6>
        <p className="text-gold/60 text-sm">Choose which defense slot to reinforce</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(DEFENSE_NAMES).map(([slotIndex, slotName]) => {
          const slot = parseInt(slotIndex, 10);
          const guardInfo = guardsBySlot.get(slot);
          const guardCategory = guardInfo?.troops?.category;
          const guardTier = guardInfo?.troops?.tier;
          const guardCount = guardInfo?.troops?.count;
          const guardCountLabel = guardCount !== undefined ? guardCount.toLocaleString() : null;
          const guardLabel = [guardTier, guardCategory].filter(Boolean).join(" ");
          const guardLabelText = guardLabel || "Unknown";
          const warningLabel = guardLabel || "matching troops";
          const troopResourceTrait = guardCategory
            ? (resources.find(
                (resource) => resource.id === getTroopResourceId(guardCategory, guardTier ?? TroopTier.T1),
              )?.trait ?? null)
            : null;
          const hasGuard = Boolean(guardInfo?.troops);
          const isSelected = guardSlot === slot;
          const isSlotAvailable = slot < maxDefenseSlots;
          const isSlotSelectable = isSlotAvailable && (canCreateDefenseArmy || hasGuard);
          const isSlotCompatible =
            !guardInfo || (guardCategory === selectedTroopCombo.type && guardTier === selectedTroopCombo.tier);
          const guardLabelClasses = clsx(
            "text-sm whitespace-nowrap font-semibold tracking-tight",
            isSlotCompatible
              ? isSelected
                ? "text-gray-950"
                : "text-gold/90"
              : isSelected
                ? "text-gray-800"
                : "text-gold/60",
          );
          const slotNameClasses = clsx(
            "text-base font-bold mb-1 tracking-wide",
            isSelected ? "text-gray-950" : "text-gold/80",
          );

          return (
            <div key={slot} className="flex flex-col items-center gap-1">
              <Button
                variant={isSelected ? "gold" : isSlotSelectable ? "outline" : "secondary"}
                onClick={() => isSlotSelectable && onSelect(slot)}
                disabled={!isSlotSelectable}
                size="lg"
                className={clsx(
                  "w-full min-h-[84px] p-4 flex flex-col items-center text-center transition-all duration-300 rounded-xl",
                  isSelected
                    ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105 bg-gradient-to-br from-gold/25 to-gold/15"
                    : isSlotSelectable
                      ? "hover:bg-gold/10 hover:border-gold/50 hover:scale-102 hover:shadow-md"
                      : "opacity-40 cursor-not-allowed",
                  hasGuard && !isSlotCompatible && "border-danger/50 hover:border-danger/60",
                )}
              >
                <div className={slotNameClasses}>{slotName}</div>
                {hasGuard ? (
                  <div className="flex items-center gap-3">
                    {troopResourceTrait && <ResourceIcon resource={troopResourceTrait} size="sm" withTooltip={false} />}
                    <div className="flex items-center gap-2">
                      {guardCountLabel && (
                        <span
                          className={clsx(
                            "text-base font-semibold whitespace-nowrap",
                            isSelected ? "text-gray-950" : "text-gold",
                          )}
                        >
                          {guardCountLabel}
                        </span>
                      )}
                      <span className={guardLabelClasses}>{guardLabelText}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={clsx(
                      "flex items-center justify-center h-10 text-sm",
                      isSelected ? "text-gray-950" : "text-gold/70",
                    )}
                  >
                    {"No defense"}
                  </div>
                )}
              </Button>
              {!canCreateDefenseArmy && !hasGuard && (
                <div className="text-xs text-gold/50 text-center">Occupied slots only</div>
              )}
              {hasGuard && !isSlotCompatible && (
                <div className="text-xs text-danger/70 text-center">Reinforce with {warningLabel}</div>
              )}
            </div>
          );
        })}
      </div>
      {defenseSlotInfoMessage && (
        <div className="mt-4 bg-brown/15 border border-gold/30 rounded-xl p-4 text-sm text-gold/80">
          {defenseSlotInfoMessage}
        </div>
      )}
      {defenseSlotErrorMessage && (
        <div className="mt-4 bg-gradient-to-r from-danger/15 to-danger/10 border-2 border-danger/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-full bg-danger/20">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <span className="text-sm text-danger/90">{defenseSlotErrorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
