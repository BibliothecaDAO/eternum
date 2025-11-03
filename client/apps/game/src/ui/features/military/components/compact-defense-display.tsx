import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { currencyFormat } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import {
  DISPLAYED_SLOT_NUMBER_MAP,
  GUARD_SLOT_NAMES,
  GuardSlot,
  resources,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { ArrowLeft, Plus } from "lucide-react";
import type { KeyboardEvent } from "react";

import { useEntityDetailLayout } from "@/ui/features/world/components/entities/layout";

import { SLOT_ICON_MAP } from "./slot-icon-map";
import { DefenseTroop } from "./structure-defence";
import { UnifiedArmyCreationModal } from "./unified-army-creation-modal";

interface CompactDefenseDisplayProps {
  troops: DefenseTroop[];
  className?: string;
  slotsUsed?: number;
  slotsMax?: number;
  structureId?: number;
  canManageDefense?: boolean;
  displayVariant?: "default" | "tight";
}

export const CompactDefenseDisplay = ({
  troops,
  className = "",
  slotsUsed,
  slotsMax,
  structureId,
  canManageDefense = false,
  displayVariant = "default",
}: CompactDefenseDisplayProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const layout = useEntityDetailLayout();
  const isTight = displayVariant === "tight";
  const totalTroopCount = troops.reduce((total, defense) => total + Number(defense.troops.count || 0), 0);
  const hasSlotInfo = slotsUsed !== undefined && slotsMax !== undefined;
  const showHeaderRow = hasSlotInfo || totalTroopCount > 0;
  const canOpenModal = Boolean(canManageDefense && structureId && structureId > 0);
  const hasAvailableDefenseSlot =
    !hasSlotInfo || (slotsUsed !== undefined && slotsMax !== undefined && slotsUsed < slotsMax);

  const labelTextClass = isTight ? "text-[9px]" : layout.density === "compact" ? "text-[9px]" : "text-[10px]";
  const valueTextClass = isTight ? "text-[10px]" : layout.density === "compact" ? "text-[10px]" : "text-[11px]";
  const slotMinWidth = isTight ? "min-w-[48px]" : layout.variant === "hud" ? "min-w-[76px]" : "min-w-[96px]";
  const slotGap = isTight ? "gap-0" : layout.variant === "hud" ? "gap-1" : "gap-1.5";
  const baseSlotClasses = cn(
    "flex items-center rounded-md px-1 transition-colors",
    layout.density === "compact" || isTight ? "py-0.5" : "py-1",
    slotGap,
  );

  const handleSlotOpen = (slot: GuardSlot) => {
    if (!canOpenModal || !structureId) return;
    toggleModal(
      <UnifiedArmyCreationModal
        structureId={structureId}
        isExplorer={false}
        maxDefenseSlots={slotsMax}
        initialGuardSlot={Number(slot)}
      />,
    );
  };

  const renderSlot = (defense: DefenseTroop) => {
    const troopCount = Number(defense.troops.count || 0);
    const rawSlot = Number(defense.slot ?? 0);
    const guardSlotKey = (
      Object.prototype.hasOwnProperty.call(GUARD_SLOT_NAMES, rawSlot) ? rawSlot : rawSlot + 1
    ) as GuardSlot;
    const slotDisplayNumber = DISPLAYED_SLOT_NUMBER_MAP[guardSlotKey];
    const slotIconSrc = SLOT_ICON_MAP[rawSlot] ?? SLOT_ICON_MAP[guardSlotKey];
    const slotName = GUARD_SLOT_NAMES[guardSlotKey] ?? `Slot ${slotDisplayNumber}`;
    const isEmptySlot = troopCount === 0;
    const isSlotInteractive = isEmptySlot ? canOpenModal && hasAvailableDefenseSlot : canOpenModal;
    const interactiveClasses = isSlotInteractive
      ? "cursor-pointer hover:border-gold/50 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      : "cursor-default";
    const onSlotClick = () => {
      if (!isSlotInteractive) return;
      handleSlotOpen(guardSlotKey);
    };
    const onSlotKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isSlotInteractive) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSlotClick();
      }
    };

    const slotBadge = (
      <div
        className={cn(
          baseSlotClasses,
          isEmptySlot
            ? "justify-center border border-dashed border-gold/30 bg-brown-900/20"
            : "border border-gold/20 bg-brown-900/90 whitespace-nowrap",
          interactiveClasses,
        )}
        title={isEmptySlot ? `Defense Slot ${slotDisplayNumber} is empty` : `Defense Slot ${slotDisplayNumber}`}
        role={isSlotInteractive ? "button" : undefined}
        tabIndex={isSlotInteractive ? 0 : undefined}
        onClick={isSlotInteractive ? onSlotClick : undefined}
        onKeyDown={isSlotInteractive ? onSlotKeyDown : undefined}
      >
        {isEmptySlot ? (
          <>
            {isSlotInteractive && <Plus className="h-3.5 w-3.5 text-gold" strokeWidth={2.5} />}
            <span className={cn(labelTextClass, isSlotInteractive ? "text-gold" : "text-gold/60", "font-semibold uppercase tracking-wide") }>
              {isSlotInteractive ? "Add" : layout.minimizeCopy ? "Empty" : "Empty Slot"}
            </span>
          </>
        ) : (
          <>
            <span className={`px-1 py-0.5 rounded text-[10px] font-bold border relative ${getTierStyle(defense.troops.tier)}`}>
              <span className="relative z-10">{defense.troops.tier}</span>
            </span>
            {!isTight && (
              <ResourceIcon
                withTooltip={false}
                resource={
                  resources.find(
                    (r) =>
                      r.id ===
                      getTroopResourceId(defense.troops.category as TroopType, defense.troops.tier as TroopTier),
                  )?.trait || ""
                }
                size={layout.density === "compact" ? "xs" : "sm"}
              />
            )}
            <span className={cn(valueTextClass, "text-gold/90 font-medium")}>{currencyFormat(troopCount, 0)}</span>
          </>
        )}
      </div>
    );

    return (
      <div key={`${rawSlot}-${guardSlotKey}`} className={cn("flex flex-col items-center", slotMinWidth)}>
        {slotBadge}
        {!isTight && (
          <div className="flex items-center gap-1">
            {slotIconSrc && (
              <img
                src={slotIconSrc}
                alt={`${slotName} icon`}
                className={layout.density === "compact" ? "h-6 w-6" : "h-8 w-8"}
                loading="lazy"
              />
            )}
            <span className={cn(labelTextClass, "font-semibold text-gold/80")}>{slotDisplayNumber}</span>
          </div>
        )}
      </div>
    );
  };

  const containerGapClass = isTight ? "gap-1" : layout.density === "compact" ? "gap-1.5" : "gap-2";

  return (
    <div className={cn("flex flex-col", containerGapClass, className)}>
      {showHeaderRow && (
        <div
          className={cn(
            "flex flex-wrap items-center",
            isTight ? "gap-1" : layout.density === "compact" ? "gap-1" : "gap-1.5",
          )}
        >
          {hasSlotInfo && (
            <div className="flex items-center bg-brown-900/80 border border-gold/25 rounded-md px-2 py-0.5 gap-1">
              <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70 font-semibold")}>
                {layout.minimizeCopy ? "Slots" : "Defense Slots"}
              </span>
              <span className={cn(valueTextClass, "text-gold font-bold")}>{slotsUsed}/{slotsMax}</span>
            </div>
          )}
          {totalTroopCount > 0 && (
            <div className="flex items-center bg-brown-900/90 border border-gold/30 rounded-md px-2 py-0.5 gap-1">
              <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70 font-semibold")}>
                {layout.minimizeCopy ? "Total" : "Total Troops"}
              </span>
              <span className={cn(valueTextClass, "text-gold font-bold")}>{currencyFormat(totalTroopCount, 0)}</span>
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex items-end overflow-x-auto",
          isTight ? "gap-1" : "gap-2",
          layout.variant === "hud" && !isTight ? "pb-0" : "pb-1",
        )}
      >
        {troops
          .slice()
          .sort((a, b) => b.slot - a.slot)
          .map((defense) => renderSlot(defense))}
        {!isTight && (
          <div className={cn("flex flex-col items-center text-center", slotGap, slotMinWidth)}>
            <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70")}>Incoming</span>
            <div
              className="rounded-full border border-gold/40 flex items-center justify-center bg-brown-900/50"
              style={{ width: layout.density === "compact" ? "36px" : "40px", height: layout.density === "compact" ? "36px" : "40px" }}
            >
              <ArrowLeft className={cn(layout.density === "compact" ? "w-4 h-4" : "w-5 h-5", "text-gold/80")} strokeWidth={2} />
            </div>
            <span className={cn(layout.density === "compact" ? "text-[9px]" : "text-[10px]", "text-gold/60")}>Enemy</span>
          </div>
        )}
      </div>
    </div>
  );
};
