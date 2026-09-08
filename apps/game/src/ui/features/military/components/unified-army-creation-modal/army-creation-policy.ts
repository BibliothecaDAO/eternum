/** Whole troops that fit both the stockpile and the selected army's remaining cap. */
export function resolveArmyTroopAvailability(available: number, capacityRemaining: number): number {
  return Math.max(0, Math.floor(Math.min(available, capacityRemaining)));
}

interface ArmyCreationStatus {
  hasStructure: boolean;
  needsProvision: boolean;
  isExplorer: boolean;
  canCreateExplorer: boolean;
  hasFreeDirection: boolean;
  hasGuardSlot: boolean;
  capacityRemaining: number | null;
  available: number;
  troopCount: number;
  isLoading: boolean;
}

export function resolveArmyCreationBlockedReason(status: ArmyCreationStatus): string | null {
  if (!status.hasStructure) return "Structure is still loading.";
  if (status.needsProvision) return "Structure not provisioned.";
  if (status.isLoading) return "Deploying army.";
  if (status.isExplorer && !status.canCreateExplorer) return "Field army cap reached.";
  if (!status.isExplorer && !status.hasGuardSlot) return "No free guard slot.";
  if (status.isExplorer && !status.hasFreeDirection) return "No free spawn hex.";
  if (status.capacityRemaining === null) return "Army capacity is still loading.";
  if (status.capacityRemaining <= 0 || status.troopCount > status.capacityRemaining) return "Troop cap reached.";
  if (status.available < 1 || status.troopCount > status.available) return "Not enough of this troop.";
  if (status.troopCount <= 0) return "Choose a troop count.";
  return null;
}
