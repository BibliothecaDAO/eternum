import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useCurrentBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

import { ARMY_DEPLOYMENT_SURFACE_ID, openArmyDeployment } from "../utils/open-army-deployment";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { TierChip } from "../utils/tier-chip";
import { knownAmount } from "@/ui/utils/utils";
import { getGuardSlotCooldownRemaining, getGuardsByStructure, getTroopResourceId } from "@bibliothecadao/eternum";
import { DISPLAYED_SLOT_NUMBER_MAP, GuardSlot, TroopTier, TroopType, formatAmount } from "@bibliothecadao/types";
import { useState } from "react";

import { getGuardStaminaSnapshot } from "../utils/guard-stamina";
import { GuardStaminaBar } from "./guard-stamina-bar";
import { GuardCooldownBadge } from "./guard-cooldown-badge";

type DefenseTroop = NonNullable<ReturnType<typeof getGuardsByStructure>>[number];

/**
 * Every guard slot on one row, a column each: a structure holds at most four (owner, 20 October 2026: "the 4 guards
 * should fit on the row").
 */
const GUARD_SLOT_ROW = "grid w-full grid-cols-4 justify-items-stretch gap-2 pb-1";

interface CompactDefenseDisplayProps {
  /** The structure's guards: a slot none of them holds is empty. */
  guards: DefenseTroop[];
  /** Every slot the structure has (structureGuardSlots). */
  slots: GuardSlot[];
  structureId: number;
  canManageDefense: boolean;
}

/**
 * The structure's guard slots, filled and empty, the slot an attacker meets first on the left. Its owner presses a slot
 * to deploy into it (owner, 20 October 2026: "I wanna see the empty slots here so I can click on it to fill them").
 */
export const CompactDefenseDisplay = ({ guards, slots, structureId, canManageDefense }: CompactDefenseDisplayProps) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const canOpenPicker = canManageDefense && structureId > 0 && ordersAllowed;
  // The slot whose picker is open stays lit until the picker closes.
  const [pickerSlot, setPickerSlot] = useState<GuardSlot | null>(null);
  const isPickerOpen = usePopoverStore((state) => state.openId === ARMY_DEPLOYMENT_SURFACE_ID);
  const guardBySlot = new Map(guards.map((guard) => [guard.slot as GuardSlot, guard]));

  const openSlot = (slot: GuardSlot, element: Element) => {
    setPickerSlot(slot);
    openArmyDeployment(
      { structureId, isExplorer: false, initialGuardSlot: slot },
      { anchor: surfaceAnchorFrom(element), placement: "beside" },
    );
  };

  return (
    <div className={GUARD_SLOT_ROW}>
      {slots.toReversed().map((slot) => (
        <GuardSlotTile
          key={slot}
          slot={slot}
          guard={guardBySlot.get(slot)}
          canOpenPicker={canOpenPicker}
          chosen={isPickerOpen && pickerSlot === slot}
          onOpen={openSlot}
        />
      ))}
    </div>
  );
};

interface GuardSlotTileProps {
  slot: GuardSlot;
  guard: DefenseTroop | undefined;
  canOpenPicker: boolean;
  chosen: boolean;
  onOpen: (slot: GuardSlot, element: Element) => void;
}

/** One slot: its guard, the wait before a wiped slot takes troops again, or an empty place to add one. */
const GuardSlotTile = ({ slot, guard, canOpenPicker, chosen, onOpen }: GuardSlotTileProps) => {
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const troopCount = guard ? Number(guard.troops.count) : 0;
  const cooldownSeconds = guard ? getGuardSlotCooldownRemaining(guard, currentBlockTimestamp) : 0;
  const isEmpty = troopCount === 0;
  // A slot that still holds troops never cools down, so this reads alike for a guard and for an empty slot.
  const isInteractive = canOpenPicker && cooldownSeconds === 0;
  const slotNumber = DISPLAYED_SLOT_NUMBER_MAP[slot];

  const className = cn(
    "flex min-h-9 w-full items-center gap-0 rounded-md border border-hud-line bg-hud-well px-1 py-0.5 transition-colors",
    isEmpty ? "justify-center border-dashed" : "whitespace-nowrap",
    isInteractive
      ? "cursor-pointer hover:border-hud-line-strong hover:bg-hud-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hud-line-strong"
      : "cursor-default",
    // The slot whose picker is open, chosen as the sheet marks a chosen thing.
    chosen && "border-hud-line-strong bg-hud-chosen",
  );
  const title =
    cooldownSeconds > 0
      ? `Defense Slot ${slotNumber} is rebuilding`
      : isEmpty
        ? `Defense Slot ${slotNumber} is empty`
        : `Defense Slot ${slotNumber}`;
  const content =
    cooldownSeconds > 0 ? (
      <GuardCooldownBadge seconds={cooldownSeconds} />
    ) : guard && !isEmpty ? (
      <GuardStack guard={guard} troopCount={troopCount} />
    ) : (
      <EmptySlot canAdd={isInteractive} />
    );

  return isInteractive ? (
    <button
      type="button"
      className={className}
      title={title}
      data-picker-open={chosen ? "true" : undefined}
      onClick={(event) => onOpen(slot, event.currentTarget)}
    >
      {content}
    </button>
  ) : (
    <div className={className} title={title}>
      {content}
    </div>
  );
};

/** A quarter of the row: the tier and the troop over the count, then the stamina. */
const GuardStack = ({ guard, troopCount }: { guard: DefenseTroop; troopCount: number }) => {
  const staminaTimestamp = useCurrentDefaultTick();
  const stamina = getGuardStaminaSnapshot(guard.troops, staminaTimestamp);
  return (
    <div className="flex min-w-0 w-full flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <TierChip tier={guard.troops.tier} />
        <ResourceIcon
          withTooltip={false}
          resource={getTroopResourceId(guard.troops.category as TroopType, guard.troops.tier as TroopTier)}
          size="xs"
          className="shrink-0"
        />
      </div>
      <span className="text-hud-label text-hud-accent tabular-nums">{formatAmount(knownAmount(troopCount))}</span>
      <GuardStaminaBar current={stamina?.current} max={stamina?.max} />
    </div>
  );
};

const EmptySlot = ({ canAdd }: { canAdd: boolean }) => (
  <>
    {canAdd && <SemanticIcon name="plus" className="h-3.5 w-3.5 text-hud-accent" />}
    <span
      className={cn(
        "text-hud-label text-hud-strong uppercase tracking-wide",
        canAdd ? "text-hud-accent" : "text-hud-muted",
      )}
    >
      {canAdd ? "Add" : "Empty"}
    </span>
  </>
);
