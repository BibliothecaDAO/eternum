import { HudSetting, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { SettingsSection } from "@/ui/modules/settings/settings-section";

import { setShowEverything, useOpeningStore } from "./use-opening";

/** Settings' Show everything: every part of Frontier's HUD at once, and no lines; kept on the account. */
export const ShowEverything = () => {
  const record = useOpeningStore((state) => state.record);
  if (!record) return null;
  return (
    <SettingsSection title={OPENING_WORDS.interface}>
      <HudSetting name={OPENING_WORDS.showEverything}>
        <HudSwitch
          on={record.showAll}
          label={OPENING_WORDS.showEverything}
          onChange={(on) => setShowEverything(on).catch((error) => toast.failed(error, OPENING_WORDS.notSaved))}
        />
      </HudSetting>
    </SettingsSection>
  );
};
