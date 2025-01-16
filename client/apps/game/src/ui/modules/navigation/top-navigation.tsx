import { Rewards } from "@/ui/modules/rewards/rewards";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { Social } from "@/ui/modules/social/social";
import { memo } from "react";

export const TopMiddleNavigation = memo(() => {
  return (
    <>
      <div className="pointer-events-auto">
        <Social />
        <Rewards />
        <SettingsWindow />
      </div>
    </>
  );
});
