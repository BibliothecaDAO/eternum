import { useUIStore } from "@/hooks/store/use-ui-store";
import { Social } from "@/ui/features/social/components/social";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { memo } from "react";

export const TopNavigation = memo(() => {
  const disableSocial = useUIStore((state) => state.disableButtons);

  return (
    <>
      <div className="pointer-events-auto">
        {!disableSocial && <Social />}
        {/* <Rewards /> */}
        <SettingsWindow />
      </div>
    </>
  );
});
