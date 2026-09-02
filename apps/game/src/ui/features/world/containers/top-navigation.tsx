import { TransactionWindow } from "@/ui/components/transaction-center";
import { ExplorationAutomationWindow } from "@/ui/features/military/components/exploration-automation-dashboard";
import { ProductionAutomationWindow } from "@/ui/features/infrastructure/automation/production-automation-dashboard";
import { LatestFeaturesWindow } from "@/ui/modules/latest-features/latest-features";
import { ShortcutsWindow } from "@/ui/modules/shortcuts/shortcuts";
import { memo } from "react";

export const TopNavigation = memo(() => {
  return (
    <>
      <div className="pointer-events-auto">
        {/* <Rewards /> */}
        {/* GameSelector removed per request: hide current game name button */}
        <ShortcutsWindow />
        <LatestFeaturesWindow />
        <TransactionWindow />
        {/* <ExplorationAutomationWindow /> */}
        <ProductionAutomationWindow />
      </div>
    </>
  );
});
