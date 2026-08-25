import { DISPLAYED_SLOT_NUMBER_MAP, GUARD_SLOT_NAMES, TroopTier, TroopType } from "@bibliothecadao/types";
import clsx from "clsx";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Timer from "lucide-react/dist/esm/icons/timer";
import { GuardStaminaBar } from "../guard-stamina-bar";
import { TransferDirection } from "./transfer-direction";
import { TroopBadge } from "./transfer-troop-badge";

interface SlotTroopInfo {
  slot: number;
  troops?: {
    tier: TroopTier;
    category: TroopType;
    count: number;
    staminaCurrent?: number;
    staminaMax?: number;
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
  const renderTroopPill = (troop?: {
    tier: TroopTier;
    category: TroopType;
    count: number;
    staminaCurrent?: number;
    staminaMax?: number;
  }) => {
    if (!troop) {
      return (
        <div className="flex flex-col gap-1">
          <div className="text-sm font-bold text-gold/70 leading-none">Empty</div>
          <div className="text-xxs uppercase tracking-wide text-gold/50">No troops</div>
        </div>
      );
    }

    const rawCount = Number(troop.count);
    const countLabel = rawCount.toLocaleString();

    return (
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <TroopBadge category={troop.category} tier={troop.tier} emphasize />
          <span className="text-sm font-bold text-gold leading-none">{countLabel}</span>
        </div>
        <div className="text-xxs uppercase tracking-wide text-gold/70">{String(troop.category)}</div>
        <GuardStaminaBar current={troop.staminaCurrent} max={troop.staminaMax} className="mt-1" />
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
