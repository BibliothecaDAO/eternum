import { useEffect } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { ActionFooter } from "./unified-army-creation-modal/action-footer";
import { TroopCountSelector } from "./unified-army-creation-modal/troop-count-selector";
import { TroopSelectionGrid } from "./unified-army-creation-modal/troop-selection-grid";
import { useArmyCreation } from "./unified-army-creation-modal/use-army-creation";
import type { ArmyDeploymentTarget } from "../utils/open-army-deployment-picker";

export const ArmyDeploymentPicker = (target: ArmyDeploymentTarget) => {
  const isSpectating = useUIStore((state) => state.isSpectating);
  const spectator = isSpectating || isExplicitSpectateSession();
  useEffect(() => {
    if (spectator) usePopoverStore.getState().close("army-deployment");
  }, [spectator]);
  if (spectator) return null;
  return <ArmyDeploymentForm {...target} />;
};

const ArmyDeploymentForm = (target: ArmyDeploymentTarget) => {
  const form = useArmyCreation({
    ...target,
    fixedContext: true,
    autoMaxOnContextChange: true,
    onSubmit: () => usePopoverStore.getState().close("army-deployment"),
  });

  return (
    <div className="w-[360px] max-w-full space-y-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{target.isExplorer ? "Deploy field army" : "Deploy guard"}</span>
        <button
          type="button"
          aria-label="Close deployment picker"
          onClick={() => usePopoverStore.getState().close("army-deployment")}
        >
          ×
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
        embedded
        compact
      />
      <p className="px-1 text-xs" role="status">
        Cost: {form.troopCount.toLocaleString()} troops{form.blockedReason ? ` · ${form.blockedReason}` : ""}
      </p>
      <ActionFooter
        armyType={target.isExplorer}
        label="Deploy"
        isLoading={form.isLoading}
        isDisabled={form.isActionDisabled}
        onSubmit={form.handleCreate}
        embedded
      />
    </div>
  );
};
