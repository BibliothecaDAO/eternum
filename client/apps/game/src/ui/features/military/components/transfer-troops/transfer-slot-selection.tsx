import { ResourceIcon } from "@/ui/design-system/molecules";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { DISPLAYED_SLOT_NUMBER_MAP, GUARD_SLOT_NAMES, resources, TroopTier, TroopType } from "@bibliothecadao/types";
import clsx from "clsx";
import { AlertTriangle, Timer } from "lucide-react";
import { TransferDirection } from "../help-container";

interface SlotTroopInfo {
  slot: number;
  troops?: {
    tier: TroopTier;
    category: TroopType;
    count: number;
  };
  cooldownEnd?: number;
}

interface BalanceOption {
  key: string;
  visible: boolean;
  troop?: {
    tier: TroopTier;
    category: TroopType;
    count: number;
  } | null;
  disabled?: boolean;
  disabledReason?: string | null;
}

interface TransferSlotSelectionProps {
  transferDirection: TransferDirection;
  slots: number[];
  orderedSlots: number[];
  guards: SlotTroopInfo[];
  selectedSlot: number | string | null;
  onSelect: (slot: number | string) => void;
  balanceOption?: BalanceOption;
  selectedTroop?: { tier?: TroopTier; category?: TroopType | string };
  targetTroop?: { tier?: TroopTier; category?: TroopType | string; count?: number | bigint };
  frontlineSlot?: number;
  lastGuardSlot?: number;
  currentBlockTimestamp: number;
}

export const TransferSlotSelection = ({
  transferDirection,
  slots,
  orderedSlots,
  guards,
  selectedSlot,
  onSelect,
  balanceOption,
  selectedTroop,
  targetTroop,
  frontlineSlot,
  lastGuardSlot,
  currentBlockTimestamp,
}: TransferSlotSelectionProps) => {
  const renderTroopPill = (troop?: { tier: TroopTier; category: TroopType; count: number }) => {
    if (!troop) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center justify-center min-w-[44px] rounded-md bg-brown/20 px-2 py-1">
            <span className="text-[10px] font-bold uppercase text-gold/50">T-</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gold/70">Empty</div>
            <div className="text-xxs uppercase tracking-wide text-gold/50">No troops</div>
          </div>
        </div>
      );
    }

    const tierText = typeof troop.tier === "string" ? troop.tier.toUpperCase() : `T${Number(troop.tier)}`;
    const typeLabel = String(troop.category).toUpperCase();
    const countLabel = currencyIntlFormat(Number(troop.count), 1);
    const troopResourceTrait =
      resources.find((resource) => resource.id === getTroopResourceId(troop.category, troop.tier))?.trait ?? null;

    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center justify-center min-w-[44px] rounded-md bg-brown/20 px-2 py-1">
          <span className="text-[10px] font-bold uppercase text-gold">{tierText}</span>
          {troopResourceTrait && (
            <ResourceIcon resource={troopResourceTrait} size="xs" withTooltip={false} className="mt-1" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gold">{countLabel}</div>
          <div className="text-xxs uppercase tracking-wide text-gold/70">{typeLabel}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20 p-2">
      <div className="grid grid-cols-2 gap-1.5">
        {balanceOption?.visible && balanceOption.troop && (
          <button
            type="button"
            onClick={() => !balanceOption.disabled && onSelect(balanceOption.key)}
            disabled={balanceOption.disabled}
            className={clsx(
              "p-2 flex flex-col gap-1 text-left transition-all duration-150 rounded border-2 relative",
              selectedSlot === balanceOption.key
                ? "border-gold bg-gold/10"
                : "border-gold/30 bg-brown/5 hover:bg-gold/5 hover:border-gold/50",
              balanceOption.disabled && "opacity-60 cursor-not-allowed bg-brown/5 border-brown/30",
            )}
          >
            <div className="absolute top-0.5 right-0.5 bg-gold/30 text-gold text-xxs px-1 rounded font-bold">0</div>
            <div className="text-xs font-bold truncate text-gold/80">Balance</div>
            {renderTroopPill(balanceOption.troop)}
            {balanceOption.disabledReason && (
              <span className="self-start border border-danger/60 bg-danger/10 text-danger px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Explorer not owned by this structure
              </span>
            )}
          </button>
        )}

        {slots.map((slotId) => {
          const guardData = guards.find((guard) => guard.slot === slotId);
          const troopInfo = guardData?.troops;
          const displayedSlotNumber = DISPLAYED_SLOT_NUMBER_MAP[slotId as keyof typeof DISPLAYED_SLOT_NUMBER_MAP];
          const slotLabel = GUARD_SLOT_NAMES[slotId as keyof typeof GUARD_SLOT_NAMES] ?? `Slot ${displayedSlotNumber}`;
          const guardCooldownEnd = guardData?.cooldownEnd ?? 0;
          const cooldownSeconds = Math.max(0, guardCooldownEnd - currentBlockTimestamp);
          const isCooldownActive = guardCooldownEnd > currentBlockTimestamp;
          const isActive = selectedSlot === slotId;
          const isSourceSelection = transferDirection === TransferDirection.StructureToExplorer;
          const isReceivingSelection = transferDirection === TransferDirection.ExplorerToStructure;

          const isSourceSlotOutOfTroops = isSourceSelection && (!troopInfo || troopInfo.count <= 0);
          const isCooldownLocked = isReceivingSelection && isCooldownActive;

          const isMismatch =
            transferDirection === TransferDirection.ExplorerToStructure
              ? troopInfo?.count !== 0 &&
                selectedTroop &&
                (selectedTroop.tier !== troopInfo?.tier || selectedTroop.category !== troopInfo?.category)
              : transferDirection === TransferDirection.StructureToExplorer &&
                targetTroop &&
                targetTroop.count !== 0 &&
                troopInfo &&
                (targetTroop.tier !== troopInfo.tier || targetTroop.category !== troopInfo.category);

          const isSlotDisabled = isSourceSlotOutOfTroops || isCooldownLocked;

          const orderIndex = orderedSlots.indexOf(slotId);
          const orderNumber = orderIndex;
          const isFrontline = frontlineSlot === slotId;
          const isFinalLine = lastGuardSlot === slotId;
          const orderBadgeClass = clsx(
            "border rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold",
            isFrontline
              ? "border-danger/50 bg-danger/10 text-danger/80"
              : isFinalLine
                ? "border-gold/40 bg-gold/10 text-gold/80"
                : "border-gold/20 bg-dark-brown/60 text-gold/60",
          );
          const orderBadgeText = (() => {
            if (isFrontline) return "Hit first";
            if (orderNumber === 2) return "Hit second";
            if (orderNumber === 1) return "Hit third";
            if (isFinalLine) return "Hit last";
            return `Order ${orderNumber}`;
          })();

          const cardClasses = clsx(
            "p-2 flex flex-col gap-1 text-left transition-all duration-150 rounded border-2 relative",
            isActive && !isMismatch && !isSlotDisabled && "border-gold bg-gold/10",
            !isActive &&
              !isMismatch &&
              !isSlotDisabled &&
              "border-gold/30 bg-brown/5 hover:bg-gold/5 hover:border-gold/50",
            isSlotDisabled && "opacity-60 cursor-not-allowed bg-brown/5 border-brown/30",
            isMismatch && "border-danger/50 hover:border-danger/60",
          );

          return (
            <button
              key={slotId}
              type="button"
              onClick={() => {
                if (isSlotDisabled) return;
                onSelect(slotId);
              }}
              disabled={isSlotDisabled}
              aria-disabled={isSlotDisabled}
              aria-pressed={isActive}
              className={cardClasses}
            >
              <div className="absolute top-0.5 right-0.5 bg-gold/30 text-gold text-xxs px-1 rounded font-bold">
                {displayedSlotNumber}
              </div>

              <div className="text-xs font-bold truncate text-gold/80">{slotLabel}</div>

              {renderTroopPill(troopInfo)}

              {orderedSlots.length > 0 && <span className={orderBadgeClass}>{orderBadgeText}</span>}

              {isCooldownActive && (
                <div className="mt-1 flex items-center gap-1.5 text-xxs text-gold/70">
                  <Timer className="w-3 h-3" />
                  <span>Cooldown — {cooldownSeconds}s</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
