import { pageNavigation } from "@/utils/page-navigation";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import {
  GRAPHICS_QUALITIES,
  readGraphicsPreferences,
  writeGraphicsPreferences,
  type GraphicsPreferences,
} from "@/three/graphics-preferences";
import { loadedGraphicsPreferences } from "@/three/render-profile";
import { HudButton, HudSetting, HudSwitch, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { canPlayHaptics } from "@/ui/motion/motion-settings";
import { useState } from "react";

export function VideoSettings() {
  const [preferences, setPreferences] = useState(() => readGraphicsPreferences(localStorage));
  const { reducedMotion, setReducedMotion, haptics, setHaptics } = useWorldAppearanceStore();
  const changeGraphics = (change: Partial<GraphicsPreferences>) => {
    const next = { ...preferences, ...change };
    writeGraphicsPreferences(localStorage, next);
    setPreferences(next);
  };
  const waiting =
    preferences.quality !== loadedGraphicsPreferences.quality ||
    preferences.shadows !== loadedGraphicsPreferences.shadows;
  return (
    <>
      <div className="ui-settings__choices">
        <HudSetting name={SETTINGS_WORDS.quality}>
          <HudTabs
            size="sm"
            tabs={GRAPHICS_QUALITIES.map((level) => ({ key: level, label: SETTINGS_WORDS.qualities[level] }))}
            value={preferences.quality}
            onChange={(quality) => changeGraphics({ quality })}
          />
        </HudSetting>
      </div>
      {waiting && (
        <div className="ui-settings__reload">
          <HudSetting name={SETTINGS_WORDS.appliesAfterReload}>
            <HudButton kind="secondary" size="sm" onClick={() => pageNavigation.reload()}>
              {SETTINGS_WORDS.reload}
            </HudButton>
          </HudSetting>
        </div>
      )}
      <HudSetting name={SETTINGS_WORDS.shadows}>
        <HudSwitch
          on={preferences.shadows}
          label={SETTINGS_WORDS.shadows}
          onChange={(shadows) => changeGraphics({ shadows })}
        />
      </HudSetting>
      <HudSetting name={SETTINGS_WORDS.reducedMotion}>
        <HudSwitch on={reducedMotion} label={SETTINGS_WORDS.reducedMotion} onChange={setReducedMotion} />
      </HudSetting>
      {canPlayHaptics() && (
        <HudSetting name={SETTINGS_WORDS.haptics}>
          <HudSwitch on={haptics} label={SETTINGS_WORDS.haptics} onChange={setHaptics} />
        </HudSetting>
      )}
    </>
  );
}
