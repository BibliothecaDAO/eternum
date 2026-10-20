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
import {
  buildRendererUrl,
  readRendererPreference,
  type RendererBuildMode,
  writeRendererPreference,
} from "@/three/renderer-build-mode";
import { RENDERER_MODES, requestedRendererMode } from "@/ui/debug/renderer-debug-control";
import { HudButton, HudSelect, HudSetting, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { useState } from "react";

const QUALITY_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High" },
] as const;

/**
 * The renderer chosen in Settings since this page loaded, with the renderer it loaded with. Settings closes and opens
 * again within one load; a saved renderer the page did not load with (an address's trial or recovery won) is not a
 * choice waiting for a reload.
 */
let chosenSinceLoad: { loaded: RendererBuildMode; mode: RendererBuildMode } | null = null;

/** The renderer a reload asks for: the one chosen since this load while it is still the saved one, else the loaded. */
const rendererToReloadOnto = (loaded: RendererBuildMode): RendererBuildMode =>
  chosenSinceLoad?.loaded === loaded && readRendererPreference(localStorage) === chosenSinceLoad.mode
    ? chosenSinceLoad.mode
    : loaded;

/**
 * Video & Graphics' rows. Quality, Frame rate, Renderer and Shadows are saved at once, but the game reads them when it
 * loads: while one differs from what this page loaded with, one row says so and reloads on asking, onto a renderer
 * chosen since this load with the page's own address kept.
 */
export function VideoSettings() {
  const [preferences, setPreferences] = useState(() => readGraphicsPreferences(localStorage));
  const [renderMode, setRenderMode] = useState(() => readRenderMode(localStorage));
  const [renderer, setRenderer] = useState(() => rendererToReloadOnto(requestedRendererMode()));
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
  const changeRenderer = (mode: RendererBuildMode) => {
    writeRendererPreference(localStorage, mode);
    chosenSinceLoad = { loaded: requestedRendererMode(), mode };
    setRenderer(mode);
  };
  const rendererChanged = renderer !== requestedRendererMode();
  const waiting =
    rendererChanged || JSON.stringify(createRenderProfile(renderMode, preferences)) !== JSON.stringify(renderProfile);
  const reload = () =>
    rendererChanged
      ? window.location.assign(buildRendererUrl(window.location.href, renderer))
      : window.location.reload();
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
      <HudSetting name="Renderer">
        <HudSelect
          label="Renderer"
          value={renderer}
          options={RENDERER_MODES.map((option) => ({ value: option.mode, label: option.label }))}
          onChange={changeRenderer}
        />
      </HudSetting>
      <HudSetting name="Shadows">
        <HudSwitch on={preferences.shadows} label="Shadows" onChange={(shadows) => changeGraphics({ shadows })} />
      </HudSetting>
      {waiting && (
        <HudSetting name="Applies after a reload">
          <HudButton kind="secondary" size="sm" onClick={reload}>
            Reload
          </HudButton>
        </HudSetting>
      )}
      <HudSetting name="Reduced motion">
        <HudSwitch on={reducedMotion} label="Reduced motion" onChange={setReducedMotion} />
      </HudSetting>
      <HudSetting name="Haptics">
        <HudSwitch on={haptics} label="Haptics" onChange={setHaptics} />
      </HudSetting>
    </>
  );
}
