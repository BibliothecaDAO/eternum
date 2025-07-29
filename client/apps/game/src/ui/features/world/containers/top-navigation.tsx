import { useUIStore } from "@/hooks/store/use-ui-store";
import { Social } from "@/ui/features/social";
import { SettingsWindow } from "@/ui/modules/settings/settings";
import { ShortcutsWindow } from "@/ui/modules/shortcuts/shortcuts";
import { memo } from "react";

export const TopNavigation = memo(() => {
  const disableSocial = useUIStore((state) => state.disableButtons);

  return (
    <>
      <div className="pointer-events-auto">
        {!disableSocial && <Social />}
        {/* <Rewards /> */}
        <SettingsWindow />
        <ShortcutsWindow />
      </div>
    </>
  );
});
