import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { DISPLAYED_SLOT_NUMBER_MAP, TroopTier, formatExact, guardSlotName, GuardSlot } from "@bibliothecadao/types";
import clsx from "clsx";

import { useMemo } from "react";

import { GuardCooldownBadge } from "../guard-cooldown-badge";
import { GuardStaminaBar } from "../guard-stamina-bar";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import type { GuardSummary, SelectedTroopCombo } from "./types";
import { TierChip } from "../../utils/tier-chip";

interface DefenseSlotSelectionProps {
  guardSlot: number;
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
      availableSlots.toSorted(
        (a, b) =>
          DISPLAYED_SLOT_NUMBER_MAP[a as keyof typeof DISPLAYED_SLOT_NUMBER_MAP] -
          DISPLAYED_SLOT_NUMBER_MAP[b as keyof typeof DISPLAYED_SLOT_NUMBER_MAP],
      ),
    [availableSlots],
  );

  const activeSlotCount = useMemo(() => {
    // Only count slots with actual troops (count > 0), matching modal's canCreateDefenseArmy logic
    return sortedSlots.filter((slot) => {
      const guard = guardsBySlot.get(slot);
      const count = guard?.troops?.count;
      return count != null && count > 0;
    }).length;
  }, [sortedSlots, guardsBySlot]);

  return (
    <div className="p-1.5 rounded-xl border border-hud-line">
      <div className="grid grid-cols-2 gap-1.5">
        {sortedSlots.map((slot) => {
          const displayedSlotNumber = DISPLAYED_SLOT_NUMBER_MAP[slot as keyof typeof DISPLAYED_SLOT_NUMBER_MAP];
          const slotName = guardSlotName(slot as GuardSlot);
          const guardInfo = guardsBySlot.get(slot);
          const guardCategory = guardInfo?.troops?.category;
          const guardTier = guardInfo?.troops?.tier;
          const guardCount = guardInfo?.troops?.count;
          const guardStaminaCurrent = guardInfo?.troops?.staminaCurrent;
          const guardStaminaMax = guardInfo?.troops?.staminaMax;
          const guardCountLabel = guardCount !== undefined ? formatExact(guardCount) : null;
          const troopResource = guardCategory ? getTroopResourceId(guardCategory, guardTier ?? TroopTier.T1) : null;
          // A wiped slot keeps its troop row at count 0 on chain; it reads as empty here, or as rebuilding.
          const hasGuard = (guardCount ?? 0) > 0;
          const cooldownSeconds = guardInfo?.cooldownRemaining ?? 0;
          const isSelected = guardSlot === slot;
          const canOpenAdditionalSlot = canCreateDefenseArmy && activeSlotCount < sortedSlots.length;
          const isSlotSelectable = hasGuard || (canOpenAdditionalSlot && cooldownSeconds === 0);
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
                  ? "border-hud-line-strong bg-hud-hover"
                  : isSlotSelectable
                    ? "border-hud-line bg-hud-well hover:bg-hud-hover hover:border-hud-line-strong"
                    : "border-hud-divider bg-hud-well opacity-40 cursor-not-allowed",
                hasGuard && !isSlotCompatible && "border-hud-bad hover:border-hud-bad",
              )}
            >
              <div className="absolute top-0.5 right-0.5 bg-hud-chosen text-hud-accent text-hud-label px-1 rounded">
                {displayedSlotNumber}
              </div>

              {hasGuard && troopResource !== null && (
                <div className="flex-shrink-0">
                  <ResourceIcon resource={troopResource} size="sm" withTooltip={false} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className={clsx("text-hud-label truncate", isSelected ? "text-hud-accent" : "text-hud-accent")}>
                  {slotName}
                </div>
                {hasGuard ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      {guardTier && <TierChip tier={guardTier} />}
                      <span className={clsx("text-hud-label", isSelected ? "text-hud-accent" : "text-hud-accent")}>
                        {guardCountLabel}
                      </span>
                    </div>
                    <GuardStaminaBar current={guardStaminaCurrent} max={guardStaminaMax} />
                  </div>
                ) : cooldownSeconds > 0 ? (
                  <GuardCooldownBadge seconds={cooldownSeconds} />
                ) : (
                  <div className={clsx("text-hud-label", isSelected ? "text-hud-accent" : "text-hud-muted")}>Empty</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {sortedSlots.length === 0 && (
        <div className="mt-1 text-hud-label text-center text-hud-muted uppercase">Upgrade to unlock slots</div>
      )}
      {defenseSlotInfoMessage && (
        <div className="mt-1">
          <HudNotice line={defenseSlotInfoMessage} />
        </div>
      )}
      {defenseSlotErrorMessage && (
        <div className="mt-1">
          <HudNotice tone="bad" line={defenseSlotErrorMessage} />
        </div>
      )}
    </div>
  );
};
