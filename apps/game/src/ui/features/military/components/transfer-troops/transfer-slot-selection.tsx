import {
  DISPLAYED_SLOT_NUMBER_MAP,
  GUARD_SLOT_NAMES,
  TroopTier,
  TroopType,
  GuardSlot,
  formatExact,
  guardSlotName,
} from "@bibliothecadao/types";
import clsx from "clsx";

import { GuardCooldownBadge } from "../guard-cooldown-badge";
import { GuardStaminaBar } from "../guard-stamina-bar";
import { TransferDirection } from "./transfer-direction";
import { acceptsTroops } from "./transfer-eligibility";
import { TroopBadge } from "./transfer-troop-badge";
import { HudChip } from "@/ui/design-system/kit/hud-elements";

interface SlotTroopInfo {
  slot: number;
  troops?: {
    tier: TroopTier;
    category: TroopType;
    count: number;
    staminaCurrent?: number;
    staminaMax?: number;
  };
  cooldownRemaining?: number;
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
          <div className="text-hud-strong text-hud-muted leading-none">Empty</div>
          <div className="text-hud-label uppercase tracking-wide text-hud-cue">No troops</div>
        </div>
      );
    }

    const rawCount = Number(troop.count);
    const countLabel = formatExact(rawCount);

    return (
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <TroopBadge category={troop.category} tier={troop.tier} emphasize />
          <span className="text-hud-strong text-hud-accent leading-none">{countLabel}</span>
        </div>
        <div className="text-hud-label uppercase tracking-wide text-hud-muted">{String(troop.category)}</div>
        <span className="mt-1 block">
          <GuardStaminaBar current={troop.staminaCurrent} max={troop.staminaMax} />
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-hud-line p-2">
      <div className="grid grid-cols-2 gap-1.5">
        {balanceOption?.visible && balanceOption.troop && (
          <button
            type="button"
            onClick={() => !balanceOption.disabled && onSelect(balanceOption.key)}
            disabled={balanceOption.disabled}
            className={clsx(
              "p-2 flex flex-col gap-1 text-left transition-all duration-150 rounded border-2 relative",
              selectedSlot === balanceOption.key
                ? "border-hud-line-strong bg-hud-hover"
                : "border-hud-line bg-hud-well hover:bg-hud-hover hover:border-hud-line-strong",
              balanceOption.disabled && "opacity-60 cursor-not-allowed bg-hud-well border-hud-divider",
            )}
          >
            <div className="absolute top-0.5 right-0.5 bg-hud-chosen text-hud-accent text-hud-label px-1 rounded">
              0
            </div>
            <div className="text-hud-label truncate text-hud-accent">Balance</div>
            {renderTroopPill(balanceOption.troop)}
            {balanceOption.disabledReason && (
              <span className="self-start">
                <HudChip tone="bad">Explorer not owned by this structure</HudChip>
              </span>
            )}
          </button>
        )}

        {slots.map((slotId) => {
          const guardData = guards.find((guard) => guard.slot === slotId);
          const troopInfo = guardData?.troops;
          const displayedSlotNumber = DISPLAYED_SLOT_NUMBER_MAP[slotId as keyof typeof DISPLAYED_SLOT_NUMBER_MAP];
          const slotLabel = guardSlotName(slotId as GuardSlot);
          const cooldownSeconds = guardData?.cooldownRemaining ?? 0;
          const isCooldownActive = cooldownSeconds > 0;
          const isActive = selectedSlot === slotId;
          const isSourceSelection = transferDirection === TransferDirection.StructureToExplorer;
          const isReceivingSelection = transferDirection === TransferDirection.ExplorerToStructure;

          const isSourceSlotOutOfTroops = isSourceSelection && (!troopInfo || troopInfo.count <= 0);
          const isCooldownLocked = isReceivingSelection && isCooldownActive;

          const isMismatch =
            transferDirection === TransferDirection.ExplorerToStructure
              ? !!selectedTroop && !acceptsTroops(troopInfo, selectedTroop)
              : transferDirection === TransferDirection.StructureToExplorer &&
                !!troopInfo &&
                !acceptsTroops(targetTroop, troopInfo);

          const isSlotDisabled = isSourceSlotOutOfTroops || isCooldownLocked;

          const orderIndex = orderedSlots.indexOf(slotId);
          const orderNumber = orderIndex;
          const isFrontline = frontlineSlot === slotId;
          const isFinalLine = lastGuardSlot === slotId;
          const orderBadgeTone = isFrontline ? "bad" : undefined;
          const orderBadgeText = (() => {
            if (isFrontline) return "Hit first";
            if (orderNumber === 2) return "Hit second";
            if (orderNumber === 1) return "Hit third";
            if (isFinalLine) return "Hit last";
            return `Order ${orderNumber}`;
          })();

          const cardClasses = clsx(
            "p-2 flex flex-col gap-1 text-left transition-all duration-150 rounded border-2 relative",
            isActive && !isMismatch && !isSlotDisabled && "border-hud-line-strong bg-hud-hover",
            !isActive &&
              !isMismatch &&
              !isSlotDisabled &&
              "border-hud-line bg-hud-well hover:bg-hud-hover hover:border-hud-line-strong",
            isSlotDisabled && "opacity-60 cursor-not-allowed bg-hud-well border-hud-divider",
            isMismatch && "border-hud-bad hover:border-hud-bad",
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
              <div className="absolute top-0.5 right-0.5 bg-hud-chosen text-hud-accent text-hud-label px-1 rounded">
                {displayedSlotNumber}
              </div>

              <div className="text-hud-label truncate text-hud-accent">{slotLabel}</div>

              {renderTroopPill(troopInfo)}

              {orderedSlots.length > 0 && <HudChip tone={orderBadgeTone}>{orderBadgeText}</HudChip>}

              {isCooldownActive && (
                <span className="mt-1 self-start">
                  <GuardCooldownBadge seconds={cooldownSeconds} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
