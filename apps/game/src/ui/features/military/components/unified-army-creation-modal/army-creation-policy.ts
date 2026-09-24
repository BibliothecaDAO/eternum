import { formatTime } from "@bibliothecadao/eternum";

import type { SelectedTroopCombo, TroopSelectionOption } from "./types";

/** Whole troops that fit both the stockpile and the selected army's remaining cap. */
export function resolveArmyTroopAvailability(available: number, capacityRemaining: number): number {
  return Math.max(0, Math.floor(Math.min(available, capacityRemaining)));
}

/** Where the selected troop comes from: the barracks on the realm board that trains it, and how fast it does now. */
export interface TroopSupply {
  /** The troop as the board names its barracks: "Knight T1". */
  name: string;
  /** Whole troops trained per hour now; zero when no barracks is training it. */
  perHour: number;
  /** Seconds until a full army is on hand at that rate; null when nothing is training. */
  secondsToFullArmy: number | null;
}

interface TroopAvailabilityStatus {
  capacityRemaining: number | null;
  available: number;
  supply: TroopSupply;
}

interface ArmyCreationStatus extends TroopAvailabilityStatus {
  hasStructure: boolean;
  needsProvision: boolean;
  isExplorer: boolean;
  canCreateExplorer: boolean;
  hasFreeDirection: boolean;
  hasGuardSlot: boolean;
  troopCount: number;
  isLoading: boolean;
}

/** Why no troop can be chosen at all: the one reason the troop count controls are disabled. */
export function resolveTroopAvailabilityReason(status: TroopAvailabilityStatus): string | null {
  if (status.capacityRemaining === null) return "Army capacity is still loading.";
  if (status.capacityRemaining <= 0) return "Troop cap reached.";
  if (status.available < 1) return describeEmptyTroop(status.supply);
  return null;
}

export function resolveArmyCreationBlockedReason(status: ArmyCreationStatus): string | null {
  if (!status.hasStructure) return "Structure is still loading.";
  if (status.needsProvision) return "Structure not provisioned.";
  if (status.isLoading) return "Deploying army.";
  if (status.isExplorer && !status.canCreateExplorer) return "Field army cap reached.";
  if (!status.isExplorer && !status.hasGuardSlot) return "No free guard slot.";
  if (status.isExplorer && !status.hasFreeDirection) return "No free spawn hex.";
  const availabilityReason = resolveTroopAvailabilityReason(status);
  if (availabilityReason) return availabilityReason;
  if (status.capacityRemaining !== null && status.troopCount > status.capacityRemaining) return "Troop cap reached.";
  if (status.troopCount > status.available) return "Not enough of this troop.";
  if (status.troopCount <= 0) return "Choose a troop count.";
  return null;
}

/** The training line while a barracks fills the next army; null when nothing trains the troop. */
export function describeTroopTraining(supply: TroopSupply): string | null {
  if (supply.perHour <= 0 || supply.secondsToFullArmy === null) return null;
  const rate = `Training ${supply.perHour.toLocaleString()} ${supply.name} per hour`;
  if (supply.secondsToFullArmy <= 0) return `${rate}; a full army is ready.`;
  return `${rate}; a full army in ${formatTime(Math.ceil(supply.secondsToFullArmy)).trim()}.`;
}

function describeEmptyTroop(supply: TroopSupply): string {
  return (
    describeTroopTraining(supply) ??
    `No ${supply.name} troops. A ${supply.name} barracks on the realm board trains them.`
  );
}

/**
 * Opens on a troop the realm holds; with none on hand, on the first troop this mode lets the realm train, so the
 * empty state names a barracks the player can actually build.
 */
export function resolveInitialTroop(
  options: TroopSelectionOption[],
  isTrainable: (troop: SelectedTroopCombo) => boolean,
): SelectedTroopCombo | null {
  const troops = options.flatMap((option) =>
    option.tiers.map((tier) => ({ type: option.type, tier: tier.tier, available: tier.available })),
  );
  const chosen = troops.find((troop) => troop.available >= 1) ?? troops.find(isTrainable);
  return chosen ? { type: chosen.type, tier: chosen.tier } : null;
}

/**
 * The spawn direction a field army is raised in: the caller's fixed choice (a clicked hex), else the current choice
 * while it is still free, else the first free direction. A remembered choice an army now stands on never blocks the
 * form while another hex is free.
 */
export function resolveSpawnDirection<Direction>(
  current: Direction | null,
  free: readonly Direction[],
  fixed: Direction | undefined,
): Direction | null {
  if (fixed !== undefined) return fixed;
  if (current !== null && free.includes(current)) return current;
  return free[0] ?? null;
}
