import { X } from "@/ui/design-system/atoms/game-icons";
import { useEffect } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ActionFooter } from "./unified-army-creation-modal/action-footer";
import { TroopCountSelector } from "./unified-army-creation-modal/troop-count-selector";
import { TroopSelectionGrid } from "./unified-army-creation-modal/troop-selection-grid";
import { useArmyCreation } from "./unified-army-creation-modal/use-army-creation";
import { DISPLAYED_SLOT_NUMBER_MAP, type GuardSlot } from "@bibliothecadao/types";
import type { ArmyDeploymentTarget } from "../utils/open-army-deployment-picker";
import { GuardDismissal } from "./guard-dismissal";

export const ArmyDeploymentPicker = (target: ArmyDeploymentTarget) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  useEffect(() => {
    if (!ordersAllowed) usePopoverStore.getState().close("army-deployment");
  }, [ordersAllowed]);
  if (!ordersAllowed) return null;
  return <ArmyDeploymentForm {...target} />;
};

const ArmyDeploymentForm = (target: ArmyDeploymentTarget) => {
  const form = useArmyCreation({
    ...target,
    fixedContext: true,
    onSubmit: () => usePopoverStore.getState().close("army-deployment"),
  });

  return (
    <div className="w-[360px] max-w-full space-y-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{describeDeploymentTarget(target)}</span>
        <button
          type="button"
          aria-label="Close deployment picker"
          onClick={() => usePopoverStore.getState().close("army-deployment")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <TroopSelectionGrid
        options={form.troopOptions}
        selected={form.selectedTroopCombo}
        isDefenseTroopLocked={form.isDefenseTroopLocked}
        selectedGuardCategory={form.selectedGuardCategory}
        selectedGuardTier={form.selectedGuardTier}
        onSelect={form.handleTroopSelect}
        bare
        compact
      />
      <TroopCountSelector
        troopCount={form.troopCount}
        maxAffordable={form.maxAffordable}
        onChange={form.handleTroopCountChange}
        capacityRemaining={form.capacityRemainingForSelector}
        troopMaxSize={form.troopCapacityLimit}
        unavailableReason={form.troopAvailabilityReason}
        embedded
        compact
      />
      {form.troopTrainingLine && <p className="px-1 text-xs text-gold/70">{form.troopTrainingLine}</p>}
      <p className="px-1 text-xs">
        Uses {form.troopCount.toLocaleString()} of {form.selectedAvailable.toLocaleString()}{" "}
        {form.selectedTroopCombo.tier} {form.selectedTroopCombo.type}
      </p>
      <ActionFooter
        armyType={target.isExplorer}
        label="Deploy"
        isLoading={form.isLoading}
        isDisabled={form.isActionDisabled}
        blockedReason={form.submitBlockedReason}
        onSubmit={form.handleCreate}
        embedded
      />
      {!target.isExplorer && target.initialGuardSlot !== undefined && (
        <GuardDismissal
          structureId={target.structureId}
          slot={target.initialGuardSlot}
          disabled={form.isLoading}
          onDismissed={() => usePopoverStore.getState().close("army-deployment")}
        />
      )}
    </div>
  );
};

/** "Deploy field army", or the guard slot the picker was opened from: "Deploy guard · slot 2". */
function describeDeploymentTarget(target: ArmyDeploymentTarget): string {
  if (target.isExplorer) return "Deploy field army";
  const slotNumber =
    target.initialGuardSlot === undefined ? undefined : DISPLAYED_SLOT_NUMBER_MAP[target.initialGuardSlot as GuardSlot];
  return slotNumber === undefined ? "Deploy guard" : `Deploy guard · slot ${slotNumber}`;
}
