import { useInstall } from "@/pwa/install-state";
import { HudButton, HudSetting } from "@/ui/design-system/kit/hud-elements";
import { APP_STATE_WORDS } from "@/shell/words";

/** The game's Settings: Install, until the app is installed (the browser's prompt, else the shell's steps sheet). */
export const InstallSetting = () => {
  const { installed, install } = useInstall();
  if (installed) return null;
  return (
    <HudSetting name={APP_STATE_WORDS.install}>
      <HudButton kind="secondary" size="sm" icon="download" onClick={() => void install()}>
        {APP_STATE_WORDS.install}
      </HudButton>
    </HudSetting>
  );
};
