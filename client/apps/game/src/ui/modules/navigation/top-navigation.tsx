import { useUIStore } from "@/hooks/store/use-ui-store";
import { Rewards } from "@/ui/modules/rewards/rewards";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { Social } from "@/ui/modules/social/social";
import { memo } from "react";

export const TopMiddleNavigation = memo(() => {
  const disableSocial = useUIStore((state) => state.disableButtons);

  return (
    <>
      <div className="pointer-events-auto">
        {!disableSocial && <Social />}
        <Rewards />
        <SettingsWindow />
      </div>
    </>
  );
});
