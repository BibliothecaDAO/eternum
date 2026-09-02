import { ExplorationAutomationWindow } from "@/ui/features/military/components/exploration-automation-dashboard";
import { ProductionAutomationWindow } from "@/ui/features/infrastructure/automation/production-automation-dashboard";
import { memo } from "react";

export const TopNavigation = memo(() => {
  return (
    <>
      <div className="pointer-events-auto">
        {/* <ExplorationAutomationWindow /> */}
        <ProductionAutomationWindow />
      </div>
    </>
  );
});
