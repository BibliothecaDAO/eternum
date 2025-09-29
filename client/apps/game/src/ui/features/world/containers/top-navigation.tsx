import { Social } from "@/ui/features/social";
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
        <SettingsWindow />
        <ShortcutsWindow />
        <LatestFeaturesWindow />
      </div>
    </>
  );
});
