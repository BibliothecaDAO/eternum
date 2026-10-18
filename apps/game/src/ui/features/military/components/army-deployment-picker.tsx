import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useEffect } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { ActionFooter } from "./unified-army-creation-modal/action-footer";
import { HudTroopAmount } from "@/ui/design-system/kit/hud-elements";
import { TroopSelectionGrid } from "./unified-army-creation-modal/troop-selection-grid";
import { useArmyCreation } from "./unified-army-creation-modal/use-army-creation";
import { DISPLAYED_SLOT_NUMBER_MAP, type GuardSlot } from "@bibliothecadao/types";
import type { ArmyDeploymentTarget } from "../utils/open-army-deployment";
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
    <div className="w-96 max-w-full space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-hud-label text-hud-muted">{describeDeploymentTarget(target)}</h2>
        <button
          type="button"
          aria-label="Close deployment picker"
          onClick={() => usePopoverStore.getState().close("army-deployment")}
        >
          <SemanticIcon name="close" className="h-4 w-4" />
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
      <HudTroopAmount
        name="Troop count"
        value={form.troopCount}
        most={form.maxAffordable}
        held={form.selectedAvailable}
        onChange={form.handleTroopCountChange}
        disabled={form.troopAvailabilityReason !== null}
      />
      <ActionFooter
        armyType={target.isExplorer}
        label={form.raiseCost ? `Deploy · ${form.raiseCost}` : "Deploy"}
        isLoading={form.isLoading}
        isDisabled={form.isActionDisabled}
        blockedReason={form.blockedReason}
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
