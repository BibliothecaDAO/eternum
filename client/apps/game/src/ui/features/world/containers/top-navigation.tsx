import { Social } from "@/ui/features/social";
import { TransferAutomationPopup } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { ArmyCreationPopupManager } from "@/ui/features/military/components/unified-army-creation-modal";
import { LatestFeaturesWindow } from "@/ui/modules/latest-features/latest-features";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { ShortcutsWindow } from "@/ui/modules/shortcuts/shortcuts";
import { memo } from "react";

export const TopNavigation = memo(() => {
  return (
    <>
      <div className="pointer-events-auto">
        {<Social />}
        {/* <Rewards /> */}
        {/* GameSelector removed per request: hide current game name button */}
        <SettingsWindow />
        <ShortcutsWindow />
        <LatestFeaturesWindow />
        <TransferAutomationPopup />
        <ArmyCreationPopupManager />
      </div>
    </>
  );
});
