import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { currencyFormat } from "@/ui/utils/utils";
import { getEntityIdFromKeys, getTroopResourceId } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  DISPLAYED_SLOT_NUMBER_MAP,
  GUARD_SLOT_NAMES,
  GuardSlot,
  resources,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { ArrowLeft, Plus } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo } from "react";

import { EntityDetailLayoutVariant } from "@/ui/features/world/components/entities/layout";

import { getStructureDefenseSlotLimit, getUnlockedGuardSlots, MAX_GUARD_SLOT_COUNT } from "../utils/defense-slot-utils";
import { SLOT_ICON_MAP } from "./slot-icon-map";
import { DefenseTroop } from "./structure-defence";

interface CompactDefenseDisplayProps {
  troops: DefenseTroop[];
  className?: string;
  slotsUsed?: number;
  slotsMax?: number;
  structureId?: number;
  canManageDefense?: boolean;
  variant?: EntityDetailLayoutVariant;
}

export const CompactDefenseDisplay = ({
  troops,
  className = "",
  slotsUsed,
  slotsMax,
  structureId,
  canManageDefense = false,
  variant = "default",
}: CompactDefenseDisplayProps) => {
  const openArmyCreationPopup = useUIStore((state) => state.openArmyCreationPopup);
  const {
    setup: { components },
  } = useDojo();
  const isBanner = variant === "banner";
  const canOpenModal = Boolean(canManageDefense && structureId && structureId > 0);
  const structureComponent = useMemo(() => {
    if (!structureId || !components?.Structure) {
      return null;
    }

    return getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureId)]));
  }, [components, structureId]);

  const structureCategory = structureComponent?.base?.category as StructureType | undefined;
  const structureLevel = structureComponent?.base?.level as number | bigint | undefined;

  const structureSlotLimit = useMemo(() => {
    return getStructureDefenseSlotLimit(structureCategory, structureLevel ?? null);
  }, [structureCategory, structureLevel]);

  const fallbackSlotLimit = slotsMax ?? undefined;
  const resolvedSlotLimit = useMemo(() => {
    if (structureSlotLimit === null || structureSlotLimit === undefined) {
      return fallbackSlotLimit ?? MAX_GUARD_SLOT_COUNT;
    }
    if (fallbackSlotLimit === undefined || fallbackSlotLimit === null) {
      return structureSlotLimit;
    }
    return Math.min(structureSlotLimit, fallbackSlotLimit);
  }, [structureSlotLimit, fallbackSlotLimit]);

  const unlockedSlots = useMemo(() => getUnlockedGuardSlots(resolvedSlotLimit), [resolvedSlotLimit]);
  const unlockedSlotSet = useMemo(() => new Set(unlockedSlots), [unlockedSlots]);

  const displayedTroops = useMemo(
    () => troops.filter((defense) => unlockedSlotSet.has(Number(defense.slot ?? -1))),
    [troops, unlockedSlotSet],
  );

  const totalTroopCount = useMemo(
    () => displayedTroops.reduce((total, defense) => total + Number(defense.troops.count || 0), 0),
    [displayedTroops],
  );

  const unlockedActiveSlotCount = useMemo(() => {
    return troops.filter((defense) => {
      const slotId = Number(defense.slot ?? -1);
      const troopCount = Number(defense.troops.count ?? 0);
      return unlockedSlotSet.has(slotId) && troopCount > 0;
    }).length;
  }, [troops, unlockedSlotSet]);

  const effectiveSlotsUsed = slotsUsed !== undefined ? Math.min(slotsUsed, resolvedSlotLimit) : unlockedActiveSlotCount;
  const hasAvailableDefenseSlot = effectiveSlotsUsed < resolvedSlotLimit;

  const slotCapForDisplay = resolvedSlotLimit ?? slotsMax;
  const hasSlotInfo = slotCapForDisplay !== undefined;
  const showHeaderRow = hasSlotInfo || totalTroopCount > 0;

  const labelTextClass = isBanner ? "text-[9px]" : "text-[10px]";
  const valueTextClass = isBanner ? "text-[10px]" : "text-[11px]";
  const slotWidthClass = "w-full";
  const slotGapClass = isBanner ? "gap-0" : "gap-1.5";
  const slotHeightClass = isBanner ? "min-h-[36px]" : "min-h-[48px]";
  const baseSlotClasses = cn(
    "flex items-center rounded-md px-1 transition-colors",
    isBanner ? "py-0.5" : "py-1",
    slotGapClass,
    slotHeightClass,
  );

  const handleSlotOpen = (slot: GuardSlot) => {
    if (!canOpenModal || !structureId) return;
    openArmyCreationPopup({
      structureId,
      isExplorer: false,
      maxDefenseSlots: resolvedSlotLimit,
      initialGuardSlot: Number(slot),
    });
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
    const isSlotUnlocked = unlockedSlotSet.has(rawSlot);
    if (!isSlotUnlocked) {
      return null;
    }

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
          "w-full",
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
            <span
              className={cn(
                labelTextClass,
                isSlotInteractive ? "text-gold" : "text-gold/60",
                "font-semibold uppercase tracking-wide",
              )}
            >
              {isSlotInteractive ? "Add" : isBanner ? "Empty" : "Empty Slot"}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-1">
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
                    r.id === getTroopResourceId(defense.troops.category as TroopType, defense.troops.tier as TroopTier),
                )?.trait || ""
              }
              size={isBanner ? "xs" : "sm"}
              className="shrink-0"
            />
            <span className={cn(valueTextClass, "text-gold/90 font-medium")}>{currencyFormat(troopCount, 0)}</span>
          </div>
        )}
      </div>
    );

    return (
      <div key={`${rawSlot}-${guardSlotKey}`} className={cn("flex flex-col items-center", slotWidthClass)}>
        {slotBadge}
        {!isBanner && (
          <div className="flex items-center gap-1">
            {slotIconSrc && (
              <img
                src={slotIconSrc}
                alt={`${slotName} icon`}
                className={isBanner ? "h-6 w-6" : "h-8 w-8"}
                loading="lazy"
              />
            )}
            <span className={cn(labelTextClass, "font-semibold text-gold/80")}>{slotDisplayNumber}</span>
          </div>
        )}
      </div>
    );
  };

  const containerGapClass = isBanner ? "gap-1" : "gap-2";

  if (isBanner) {
    return (
      <div className={cn("flex flex-col", containerGapClass, className)}>
        {showHeaderRow && (
          <div className="flex items-center gap-2 w-full">
            {hasSlotInfo && (
              <div
                className={cn(
                  "flex items-center justify-between bg-brown-900/80 border border-gold/25 rounded-md px-2 py-0.5 gap-1",
                  slotWidthClass,
                )}
              >
                <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70 font-semibold")}>Slots</span>
                <span className={cn(valueTextClass, "text-gold font-bold")}>
                  {effectiveSlotsUsed}/{slotCapForDisplay}
                </span>
              </div>
            )}
            {totalTroopCount > 0 && (
              <div
                className={cn(
                  "flex items-center justify-between bg-brown-900/90 border border-gold/30 rounded-md px-2 py-0.5 gap-1",
                  slotWidthClass,
                )}
              >
                <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70 font-semibold")}>Total</span>
                <span className={cn(valueTextClass, "text-gold font-bold")}>{currencyFormat(totalTroopCount, 0)}</span>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pb-1 justify-items-stretch w-full">
          {displayedTroops
            .slice()
            .sort((a, b) => b.slot - a.slot)
            .map((defense) => renderSlot(defense))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col overflow-x-auto scrollbar-hide", containerGapClass, className)}>
      {showHeaderRow && (
        <div className="grid grid-cols-2 gap-2 w-full flex-shrink-0">
          {hasSlotInfo && (
            <div
              className={cn(
                "flex items-center justify-between bg-brown-900/80 border border-gold/25 rounded-md px-2 py-0.5 gap-1",
                slotWidthClass,
              )}
            >
              <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70 font-semibold")}>
                {isBanner ? "Slots" : "Defense Slots"}
              </span>
              <span className={cn(valueTextClass, "text-gold font-bold")}>
                {effectiveSlotsUsed}/{slotCapForDisplay}
              </span>
            </div>
          )}
          {totalTroopCount > 0 && (
            <div
              className={cn(
                "flex items-center justify-between bg-brown-900/90 border border-gold/30 rounded-md px-2 py-0.5 gap-1",
                slotWidthClass,
              )}
            >
              <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70 font-semibold")}>
                {isBanner ? "Total" : "Total Troops"}
              </span>
              <span className={cn(valueTextClass, "text-gold font-bold")}>{currencyFormat(totalTroopCount, 0)}</span>
            </div>
          )}
        </div>
      )}
      <div className={cn("grid grid-cols-2", "gap-2", "justify-items-stretch", isBanner ? "pb-0" : "pb-1", "w-full")}>
        {displayedTroops
          .slice()
          .sort((a, b) => b.slot - a.slot)
          .map((defense) => renderSlot(defense))}
        {!isBanner && (
          <div
            className={cn(
              "flex flex-col items-center text-center flex-shrink-0 col-span-2 sm:col-span-1",
              slotGapClass,
              slotWidthClass,
            )}
          >
            <span className={cn(labelTextClass, "uppercase tracking-wide text-gold/70")}>Incoming</span>
            <div
              className="rounded-full border border-gold/40 flex items-center justify-center bg-brown-900/50"
              style={{
                width: isBanner ? "36px" : "40px",
                height: isBanner ? "36px" : "40px",
              }}
            >
              <ArrowLeft className={cn(isBanner ? "w-4 h-4" : "w-5 h-5", "text-gold/80")} strokeWidth={2} />
            </div>
            <span className={cn(isBanner ? "text-[9px]" : "text-[10px]", "text-gold/60")}>Enemy</span>
          </div>
        )}
      </div>
    </div>
  );
};
