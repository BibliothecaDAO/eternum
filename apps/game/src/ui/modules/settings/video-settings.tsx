import { pageNavigation } from "@/utils/page-navigation";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import {
  readGraphicsPreferences,
  writeGraphicsPreferences,
  type GraphicsPreferences,
} from "@/three/graphics-preferences";
import {
  createRenderProfile,
  readRenderMode,
  RENDER_MODE_OPTIONS,
  renderProfile,
  type RenderMode,
  writeRenderMode,
} from "@/three/render-profile";
import { HudButton, HudSetting, HudSwitch, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { canPlayHaptics } from "@/ui/motion/motion-settings";
import { useState } from "react";

const QUALITY_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High" },
] as const;

/**
 * Video & Graphics' rows. Quality, Frame rate and Shadows are saved at once, but the game reads them when it loads: while
 * one differs from what this page loaded with, one row says so and reloads on asking. The renderer is the build's
 * (WebGPU, falling back to WebGL2 by itself), or the address's `rendererMode`. Haptics shows only where the device
 * plays them (an Android phone, the iOS app).
 */
export function VideoSettings() {
  const [preferences, setPreferences] = useState(() => readGraphicsPreferences(localStorage));
  const [renderMode, setRenderMode] = useState(() => readRenderMode(localStorage));
  const { reducedMotion, setReducedMotion, haptics, setHaptics } = useWorldAppearanceStore();
  const changeGraphics = (change: Partial<GraphicsPreferences>) => {
    const next = { ...preferences, ...change };
    writeGraphicsPreferences(localStorage, next);
    setPreferences(next);
  };
  const changeRenderMode = (mode: RenderMode) => {
    writeRenderMode(localStorage, mode);
    setRenderMode(mode);
  };
  const waiting = JSON.stringify(createRenderProfile(renderMode, preferences)) !== JSON.stringify(renderProfile);
  return (
    <>
      <div className="ui-settings__choices">
        <HudSetting name={SETTINGS_WORDS.quality}>
          <HudTabs
            size="sm"
            tabs={QUALITY_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
            value={preferences.quality}
            onChange={(quality) => changeGraphics({ quality })}
          />
        </HudSetting>
        <HudSetting name={SETTINGS_WORDS.frameRate}>
          <HudTabs
            size="sm"
            tabs={RENDER_MODE_OPTIONS.map((option) => ({ key: option.mode, label: option.label }))}
            value={renderMode}
            onChange={changeRenderMode}
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
