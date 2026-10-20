import { useEffect } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { HudWindow } from "@/ui/design-system/kit/hud-elements";
import { DeployTroops, DeployVerb } from "./unified-army-creation-modal/deploy-form";
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
  const close = () => usePopoverStore.getState().close("army-deployment");
  const form = useArmyCreation({
    ...target,
    initialTroopCount: target.troopCount,
    fixedContext: true,
    onSubmit: close,
  });

  return (
    <HudWindow title={describeDeploymentTarget(target)} icon="military" size="fit" onClose={close}>
      <div className="flex w-96 max-w-full flex-col gap-3">
        <DeployTroops form={form} />
        {!target.isExplorer && target.initialGuardSlot !== undefined && (
          <GuardDismissal
            structureId={target.structureId}
            slot={target.initialGuardSlot}
            disabled={form.isLoading}
            onDismissed={close}
          />
        )}
      </div>
      <DeployVerb form={form} />
    </HudWindow>
  );
};

/** "Deploy field army", or the guard slot the picker was opened from: "Deploy guard · slot 2". */
function describeDeploymentTarget(target: ArmyDeploymentTarget): string {
  if (target.isExplorer) return "Deploy field army";
  const slotNumber =
    target.initialGuardSlot === undefined ? undefined : DISPLAYED_SLOT_NUMBER_MAP[target.initialGuardSlot as GuardSlot];
  return slotNumber === undefined ? "Deploy guard" : `Deploy guard · slot ${slotNumber}`;
}
