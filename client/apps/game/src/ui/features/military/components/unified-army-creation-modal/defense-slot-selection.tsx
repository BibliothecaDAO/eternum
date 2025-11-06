import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { DISPLAYED_SLOT_NUMBER_MAP, GUARD_SLOT_NAMES, resources, TroopTier } from "@bibliothecadao/types";
import clsx from "clsx";
import { AlertTriangle, Shield } from "lucide-react";
import { useMemo } from "react";

import type { GuardSummary, SelectedTroopCombo } from "./types";

interface DefenseSlotSelectionProps {
  guardSlot: number;
  maxDefenseSlots: number;
  guardsBySlot: Map<number, GuardSummary>;
  availableSlots: number[];
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
  availableSlots,
  selectedTroopCombo,
  canCreateDefenseArmy,
  defenseSlotInfoMessage,
  defenseSlotErrorMessage,
  onSelect,
}: DefenseSlotSelectionProps) => {
  const sortedSlots = useMemo(
    () =>
      [...availableSlots].sort(
        (a, b) =>
          DISPLAYED_SLOT_NUMBER_MAP[a as keyof typeof DISPLAYED_SLOT_NUMBER_MAP] -
          DISPLAYED_SLOT_NUMBER_MAP[b as keyof typeof DISPLAYED_SLOT_NUMBER_MAP],
      ),
    [availableSlots],
  );

  const activeSlotCount = useMemo(() => {
    return sortedSlots.filter((slot) => guardsBySlot.has(slot)).length;
  }, [sortedSlots, guardsBySlot]);

  const unlockedCapacity = Math.min(sortedSlots.length, maxDefenseSlots);

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
      <div className="text-center mb-4">
        <h6 className="text-gold text-lg font-bold mb-1">DEFENSE SLOTS</h6>
        <div className="flex items-center justify-center gap-2 text-gold/60 text-sm">
          <Shield className="w-4 h-4" />
          <p>Enemies attack highest slot first</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sortedSlots.map((slot) => {
          const displayedSlotNumber = DISPLAYED_SLOT_NUMBER_MAP[slot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP];
          const slotName = GUARD_SLOT_NAMES[slot as keyof typeof GUARD_SLOT_NAMES];
          const guardInfo = guardsBySlot.get(slot);
          const guardCategory = guardInfo?.troops?.category;
          const guardTier = guardInfo?.troops?.tier;
          const guardCount = guardInfo?.troops?.count;
          const guardCountLabel = guardCount !== undefined ? guardCount.toLocaleString() : null;
          const guardLabel = [guardTier, guardCategory].filter(Boolean).join(" ");
          const guardLabelText = guardLabel || "Unknown";
          const troopResourceTrait = guardCategory
            ? (resources.find(
                (resource) => resource.id === getTroopResourceId(guardCategory, guardTier ?? TroopTier.T1),
              )?.trait ?? null)
            : null;
          const hasGuard = Boolean(guardInfo?.troops);
          const isSelected = guardSlot === slot;
          const canOpenAdditionalSlot = canCreateDefenseArmy && activeSlotCount < unlockedCapacity;
          const isSlotSelectable = hasGuard || canOpenAdditionalSlot;
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
                  "w-full min-h-[84px] p-4 flex flex-col items-center text-center transition-all duration-300 rounded-xl relative",
                  isSelected
                    ? "ring-2 ring-gold/60 shadow-xl shadow-gold/30 scale-105 bg-gradient-to-br from-gold/25 to-gold/15"
                    : isSlotSelectable
                      ? "hover:bg-gold/10 hover:border-gold/50 hover:scale-102 hover:shadow-md"
                      : "opacity-50 cursor-not-allowed",
                  hasGuard && !isSlotCompatible && "border-danger/50 hover:border-danger/60",
                )}
              >
                <div className="absolute -top-2 -right-2 bg-gradient-to-br from-gold/90 to-gold/70 text-brown text-xs px-2 py-0.5 rounded-full border-2 border-gold shadow-lg font-bold">
                  {displayedSlotNumber}
                </div>
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
                <div className="text-xs text-gold/50 text-center">Cannot create new defense slot</div>
              )}
            </div>
          );
        })}
      </div>
      {sortedSlots.length === 0 && (
        <div className="mt-4 text-xs text-center text-gold/60 uppercase tracking-wide">
          Upgrade this structure to unlock defense slots
        </div>
      )}
      {defenseSlotInfoMessage && (
        <div className="mt-4 bg-brown/15 border border-gold/30 mb-6 rounded-xl p-4 text-sm text-gold/80">
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
