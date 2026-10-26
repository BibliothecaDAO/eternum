import { APP_STATE_WORDS, SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { useInstall } from "@/pwa/install-state";
import { HudButton, HudSetting } from "@/ui/design-system/kit/hud-elements";
import { isCoarsePointer } from "@/utils/pointer";
import { KeyboardShortcutsSetting } from "./keyboard-shortcuts";
import { SettingsSection } from "./settings-section";

/**
 * Settings' App section: Install until the app is installed (the browser's prompt, else the shell's steps sheet), and
 * the keys where a keyboard is the way in, not on a touch-first device where no key does anything. With neither, no
 * section.
 */
export const AppSettings = ({ onShowKeys }: { onShowKeys: () => void }) => {
  const { installed, install } = useInstall();
  const keys = !isCoarsePointer();
  if (installed && !keys) return null;
  return (
    <SettingsSection title={SETTINGS_WORDS.app}>
      {!installed && (
        <HudSetting name={APP_STATE_WORDS.install}>
          <HudButton kind="secondary" size="sm" icon="download" onClick={() => install()}>
            {APP_STATE_WORDS.install}
          </HudButton>
        </HudSetting>
      )}
      {keys && <KeyboardShortcutsSetting onShow={onShowKeys} />}
    </SettingsSection>
  );
};
