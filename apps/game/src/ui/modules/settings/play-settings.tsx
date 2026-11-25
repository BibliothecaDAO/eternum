import { pageNavigation } from "@/utils/page-navigation";
import {
  GRAPHICS_QUALITIES,
  readGraphicsPreferences,
  writeGraphicsPreferences,
  type GraphicsPreferences,
  type GraphicsQuality,
} from "@/three/graphics-preferences";
import {
  createRenderProfile,
  readRenderMode,
  RENDER_MODE_OPTIONS,
  renderProfile,
  type RenderMode,
  writeRenderMode,
} from "@/three/render-profile";
import { HudButton, HudChoice, HudSetting, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { useAudio } from "@/audio";
import { getGameModeId } from "@/config/game-modes";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { hudFor } from "@/ui/layouts/hud-for";
import { canPlayHaptics } from "@/ui/motion/motion-settings";
import { OPENING_WORDS, SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { type ReactNode, useState } from "react";

const QUALITY_WORDS: Record<GraphicsQuality, string> = { balanced: "Mid", high: "High" };
const QUALITY_OPTIONS = GRAPHICS_QUALITIES.map((quality) => ({ value: quality, label: QUALITY_WORDS[quality] }));

const useGraphicsSettings = () => {
  const [preferences, setPreferences] = useState(() => readGraphicsPreferences(localStorage));
  const [renderMode, setRenderMode] = useState(() => readRenderMode(localStorage));
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
  return { preferences, renderMode, changeGraphics, changeRenderMode, waiting };
};

type GraphicsSettings = ReturnType<typeof useGraphicsSettings>;

const GraphicsChoices = ({ graphics }: { graphics: GraphicsSettings }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
    <Choice label={SETTINGS_WORDS.quality}>
      <HudChoice
        label={SETTINGS_WORDS.quality}
        value={graphics.preferences.quality}
        options={QUALITY_OPTIONS}
        onChange={(quality) => graphics.changeGraphics({ quality })}
      />
    </Choice>
    <Choice label={SETTINGS_WORDS.frameRate}>
      <HudChoice
        label={SETTINGS_WORDS.frameRate}
        value={graphics.renderMode}
        options={RENDER_MODE_OPTIONS.map((option) => ({ value: option.mode, label: option.label }))}
        onChange={graphics.changeRenderMode}
      />
    </Choice>
  </div>
);

const Choice = ({ label, children }: { label: string; children: ReactNode }) => (
  <span className="flex items-center gap-2">
    <span className="text-hud-label uppercase tracking-wide text-hud-muted">{label}</span>
    {children}
  </span>
);

const ReloadToApply = ({ graphics }: { graphics: GraphicsSettings }) =>
  graphics.waiting ? (
    <HudSetting name={SETTINGS_WORDS.appliesAfterReload}>
      <HudButton kind="secondary" size="sm" onClick={() => pageNavigation.reload()}>
        {SETTINGS_WORDS.reload}
      </HudButton>
    </HudSetting>
  ) : null;

export function PlaySettings() {
  const graphics = useGraphicsSettings();
  const { setMuted, audioState } = useAudio();
  const { reducedMotion, setReducedMotion, haptics, setHaptics, showEverything, setShowEverything } =
    useWorldAppearanceStore();
  const switches = [
    { name: SETTINGS_WORDS.mute, on: audioState?.muted ?? false, onChange: setMuted },
    {
      name: SETTINGS_WORDS.shadows,
      on: graphics.preferences.shadows,
      onChange: (shadows: boolean) => graphics.changeGraphics({ shadows }),
    },
    ...(canPlayHaptics() ? [{ name: SETTINGS_WORDS.haptics, on: haptics, onChange: setHaptics }] : []),
    { name: SETTINGS_WORDS.reducedMotion, on: reducedMotion, onChange: setReducedMotion },
    ...(hudFor(getGameModeId(), true) === "frontier"
      ? [{ name: OPENING_WORDS.showEverything, on: showEverything, onChange: setShowEverything }]
      : []),
  ];
  return (
    <>
      <GraphicsChoices graphics={graphics} />
      <div className="grid grid-cols-2 gap-2">
        {switches.map((setting) => (
          <div key={setting.name} className="flex items-center justify-between gap-2 rounded-lg bg-hud-well px-3 py-2">
            <span className="min-w-0 text-hud-body leading-tight text-hud-ink">{setting.name}</span>
            <HudSwitch on={setting.on} label={setting.name} onChange={setting.onChange} />
          </div>
        ))}
      </div>
      <ReloadToApply graphics={graphics} />
    </>
  );
}
