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
      <div className="grid grid-cols-4 gap-1.5">
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
            <Button
              key={slot}
              variant={isSelected ? "gold" : isSlotSelectable ? "outline" : "secondary"}
              onClick={() => isSlotSelectable && onSelect(slot)}
              disabled={!isSlotSelectable}
              className={clsx(
                "w-full p-1.5 flex flex-col items-center text-center transition-all duration-200 rounded-lg relative aspect-square",
                isSelected
                  ? "ring-2 ring-gold shadow-xl shadow-gold/40 scale-105 bg-gradient-to-br from-gold/25 to-gold/15"
                  : isSlotSelectable
                    ? "hover:bg-gold/10 hover:border-gold/50 hover:scale-105 hover:shadow-md"
                    : "opacity-40 cursor-not-allowed",
                hasGuard && !isSlotCompatible && "border-danger/50 hover:border-danger/60",
                hasGuard && "border-2 border-gold/40",
              )}
            >
              <div className="absolute top-0.5 right-0.5 bg-gradient-to-br from-gold to-gold/80 text-brown text-xxs px-1 py-0.5 rounded-full border border-gold font-extrabold">
                {displayedSlotNumber}
              </div>
              <div className={clsx("text-xxs font-bold truncate w-full", isSelected ? "text-gray-950" : "text-gold/80")}>
                {slotName}
              </div>
              {hasGuard ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-0.5 w-full">
                  {troopResourceTrait && <ResourceIcon resource={troopResourceTrait} size="xs" withTooltip={false} />}
                  <div className={clsx("text-xxs font-bold", isSelected ? "text-gray-950" : "text-gold")}>
                    {guardCountLabel}
                  </div>
                </div>
              ) : (
                <div className={clsx("flex-1 flex items-center justify-center text-xxs", isSelected ? "text-gray-950" : "text-gold/70")}>
                  Empty
                </div>
              )}
            </Button>
          );
        })}
      </div>
      {sortedSlots.length === 0 && (
        <div className="mt-2 text-xxs text-center text-gold/60 uppercase">
          Upgrade to unlock slots
        </div>
      )}
      {defenseSlotInfoMessage && (
        <div className="mt-1.5 bg-brown/15 border-l-2 border-gold rounded px-2 py-1 text-xxs text-gold/80 font-medium">
          {defenseSlotInfoMessage}
        </div>
      )}
      {defenseSlotErrorMessage && (
        <div className="mt-1.5 bg-danger/10 border-l-2 border-danger rounded px-2 py-1 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-danger flex-shrink-0" />
          <span className="text-xxs text-danger font-semibold">{defenseSlotErrorMessage}</span>
        </div>
      )}
    </div>
  );
};
