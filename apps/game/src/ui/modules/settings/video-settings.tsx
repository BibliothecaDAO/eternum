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
import { HudButton, HudSelect, HudSetting, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { canVibrate } from "@/ui/motion/motion-settings";
import { useState } from "react";

const QUALITY_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High" },
] as const;

/**
 * Video & Graphics' rows. Quality, Frame rate and Shadows are saved at once, but the game reads them when it loads: while
 * one differs from what this page loaded with, one row says so and reloads on asking. The renderer is the build's
 * (WebGPU, falling back to WebGL2 by itself), or the address's `rendererMode`. Haptics shows only where the device can
 * vibrate.
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
      <HudSetting name="Quality">
        <HudSelect
          label="Quality"
          value={preferences.quality}
          options={QUALITY_OPTIONS}
          onChange={(quality) => changeGraphics({ quality })}
        />
      </HudSetting>
      <HudSetting name="Frame rate">
        <HudSelect
          label="Frame rate"
          value={renderMode}
          options={RENDER_MODE_OPTIONS.map((option) => ({ value: option.mode, label: option.label }))}
          onChange={changeRenderMode}
        />
      </HudSetting>
      <HudSetting name="Shadows">
        <HudSwitch on={preferences.shadows} label="Shadows" onChange={(shadows) => changeGraphics({ shadows })} />
      </HudSetting>
      {waiting && (
        <HudSetting name="Applies after a reload">
          <HudButton kind="secondary" size="sm" onClick={() => window.location.reload()}>
            Reload
          </HudButton>
        </HudSetting>
      )}
      <HudSetting name="Reduced motion">
        <HudSwitch on={reducedMotion} label="Reduced motion" onChange={setReducedMotion} />
      </HudSetting>
      {canVibrate() && (
        <HudSetting name="Haptics">
          <HudSwitch on={haptics} label="Haptics" onChange={setHaptics} />
        </HudSetting>
      )}
    </>
  );
}
