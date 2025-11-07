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
    <div className="p-1.5 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20">
      <div className="grid grid-cols-2 gap-1.5">
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
          return (
            <button
              key={slot}
              onClick={() => isSlotSelectable && onSelect(slot)}
              disabled={!isSlotSelectable}
              className={clsx(
                "p-2 flex items-center gap-2 text-left transition-all duration-150 rounded border-2 relative",
                isSelected
                  ? "border-gold bg-gold/10"
                  : isSlotSelectable
                    ? "border-gold/30 bg-brown/5 hover:bg-gold/5 hover:border-gold/50"
                    : "border-brown/20 bg-brown/5 opacity-40 cursor-not-allowed",
                hasGuard && !isSlotCompatible && "border-danger/50 hover:border-danger/60",
              )}
            >
              <div className="absolute top-0.5 right-0.5 bg-gold/30 text-gold text-xxs px-1 rounded font-bold">
                {displayedSlotNumber}
              </div>

              {hasGuard && troopResourceTrait && (
                <div className="flex-shrink-0">
                  <ResourceIcon resource={troopResourceTrait} size="sm" withTooltip={false} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className={clsx("text-xs font-bold truncate", isSelected ? "text-gold" : "text-gold/80")}>
                  {slotName}
                </div>
                {hasGuard ? (
                  <div className={clsx("text-xs font-bold", isSelected ? "text-gold" : "text-gold/90")}>
                    {guardCountLabel}
                  </div>
                ) : (
                  <div className={clsx("text-xxs", isSelected ? "text-gold" : "text-gold/60")}>Empty</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {sortedSlots.length === 0 && (
        <div className="mt-1 text-xxs text-center text-gold/60 uppercase">Upgrade to unlock slots</div>
      )}
      {defenseSlotInfoMessage && (
        <div className="mt-1 bg-brown/15 border-l-2 border-gold rounded px-2 py-0.5 text-xxs text-gold/80 font-medium">
          {defenseSlotInfoMessage}
        </div>
      )}
      {defenseSlotErrorMessage && (
        <div className="mt-1 bg-danger/10 border-l-2 border-danger rounded px-2 py-0.5 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-danger flex-shrink-0" />
          <span className="text-xxs text-danger font-semibold">{defenseSlotErrorMessage}</span>
        </div>
      )}
    </div>
  );
};
