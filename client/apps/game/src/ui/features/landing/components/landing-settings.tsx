import { AudioCategory, useAudio, useMusicPlayer, ScrollingTrackName } from "@/audio";
import { GraphicsSettings } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Maximize2, Minimize2, Monitor, Music, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";

interface DocumentWithFullscreen extends HTMLDocument {
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitFullscreenElement?: Element;
  msExitFullscreen?: () => void;
  mozCancelFullScreen?: () => void;
  webkitExitFullscreen?: () => void;
}

interface DocumentElementWithFullscreen extends HTMLElement {
  msRequestFullscreen?: () => void;
  mozRequestFullScreen?: () => void;
  webkitRequestFullscreen?: () => void;
}

const isDocumentFullScreen = () => {
  if (typeof document === "undefined") {
    return false;
  }

  const doc = document as DocumentWithFullscreen;
  return !!(
    doc.fullscreenElement ||
    doc.mozFullScreenElement ||
    doc.webkitFullscreenElement ||
    doc.msFullscreenElement
  );
};

const enterFullScreen = (element: DocumentElementWithFullscreen) => {
  if (element.requestFullscreen) {
    void element.requestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  }
};

const exitFullScreen = (doc: DocumentWithFullscreen) => {
  if (doc.exitFullscreen) {
    void doc.exitFullscreen();
  } else if (doc.msExitFullscreen) {
    doc.msExitFullscreen();
  } else if (doc.webkitExitFullscreen) {
    doc.webkitExitFullscreen();
  } else if (doc.mozCancelFullScreen) {
    doc.mozCancelFullScreen();
  }
};

interface LandingSettingsProps {
  onClose: () => void;
  className?: string;
}

const SETTINGS_SHELL_CLASS = [
  "relative w-full max-w-md overflow-hidden rounded-[22px]",
  "border border-gold/18 bg-[linear-gradient(180deg,rgba(11,11,11,0.96),rgba(6,6,6,0.92))]",
  "p-5 shadow-[0_28px_90px_-42px_rgba(0,0,0,0.95)] backdrop-blur-xl",
].join(" ");

const SETTINGS_SECTION_CLASS = [
  "rounded-[18px] border border-gold/12 bg-black/30 px-4 py-4",
  "shadow-[inset_0_1px_0_rgba(223,170,84,0.05)]",
].join(" ");

const SETTINGS_CONTROL_CLASS = [
  "rounded-[14px] border border-gold/14 bg-black/35",
  "shadow-[inset_0_1px_0_rgba(223,170,84,0.04)]",
].join(" ");

const SETTINGS_ACTION_BUTTON_CLASS = [
  "inline-flex items-center justify-center rounded-[14px] border border-gold/16 bg-black/35",
  "px-3 py-2 text-sm font-medium text-gold/80 transition-colors",
  "hover:border-gold/28 hover:bg-gold/[0.08] hover:text-gold",
].join(" ");

const SETTINGS_CHOICE_BUTTON_BASE_CLASS = [
  "inline-flex items-center justify-center rounded-[12px] border px-3 py-2 text-sm font-medium transition-colors",
].join(" ");

const LandingSettingsSection = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Volume2;
  title: string;
  children: React.ReactNode;
}) => (
  <section className={SETTINGS_SECTION_CLASS}>
    <div className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-gold/72">
      <Icon className="h-4 w-4 text-gold/55" />
      <span>{title}</span>
    </div>
    <div className="space-y-3">{children}</div>
  </section>
);

const LandingSettingsSlider = ({
  label,
  value,
  onChange,
  trailing,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  trailing?: React.ReactNode;
}) => (
  <div className={cn(SETTINGS_CONTROL_CLASS, "px-3 py-3")}>
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-sm text-gold/72">{label}</span>
      {trailing ?? <span className="text-[11px] font-medium text-gold/45">{value}%</span>}
    </div>
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={value}
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#dfaa54]"
    />
    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-gold/32">
      <span>0</span>
      <span>100</span>
    </div>
  </div>
);

/**
 * Simplified settings panel for the landing page.
 * Includes audio controls and basic preferences.
 */
export const LandingSettings = ({ onClose, className }: LandingSettingsProps) => {
  const { setCategoryVolume, setMasterVolume, setMuted, audioState } = useAudio();
  const { trackName, next: nextTrack } = useMusicPlayer();
  const [fullScreen, setFullScreen] = useState<boolean>(() => isDocumentFullScreen());

  useEffect(() => {
    const syncFullScreenState = () => {
      setFullScreen(isDocumentFullScreen());
    };

    syncFullScreenState();

    document.addEventListener("fullscreenchange", syncFullScreenState);
    document.addEventListener("webkitfullscreenchange", syncFullScreenState as EventListener);
    document.addEventListener("mozfullscreenchange", syncFullScreenState as EventListener);
    document.addEventListener("MSFullscreenChange", syncFullScreenState as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullScreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullScreenState as EventListener);
      document.removeEventListener("mozfullscreenchange", syncFullScreenState as EventListener);
      document.removeEventListener("MSFullscreenChange", syncFullScreenState as EventListener);
    };
  }, []);

  const handleFullScreen = () => {
    if (!isDocumentFullScreen()) {
      enterFullScreen(document.documentElement as DocumentElementWithFullscreen);
      return;
    }

    exitFullScreen(document as DocumentWithFullscreen);
  };

  // Get volume values with safe defaults
  const masterVolume = audioState?.masterVolume ?? 1;
  const isMuted = audioState?.muted ?? false;
  const musicVolume = audioState?.categoryVolumes?.[AudioCategory.MUSIC] ?? 0.08;
  const uiVolume = audioState?.categoryVolumes?.[AudioCategory.UI] ?? 0.2;
  const graphicsSetting = (localStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings) || GraphicsSettings.HIGH;

  const handleGraphicsSettingChange = (setting: GraphicsSettings) => {
    if (graphicsSetting === setting) return;
    localStorage.setItem("GRAPHICS_SETTING", setting);
    window.location.reload();
  };

  return (
    <div className={cn(SETTINGS_SHELL_CLASS, className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(223,170,84,0.14),transparent_68%)]" />

      <div className="relative mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold/42">Dashboard</p>
          <h2 className="font-serif text-[28px] font-semibold text-gold">Settings</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            SETTINGS_CONTROL_CLASS,
            "flex h-10 w-10 items-center justify-center text-gold/58 transition-colors hover:border-gold/26 hover:bg-gold/[0.08] hover:text-gold",
          )}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <LandingSettingsSection icon={Volume2} title="Audio">
          <LandingSettingsSlider
            label="Master Volume"
            value={Math.round(masterVolume * 100)}
            onChange={(value) => setMasterVolume(value / 100)}
            trailing={
              <button
                type="button"
                onClick={() => setMuted(!isMuted)}
                className={cn(
                  SETTINGS_CONTROL_CLASS,
                  "flex h-8 w-8 items-center justify-center text-gold/58 transition-colors hover:border-gold/26 hover:bg-gold/[0.08] hover:text-gold",
                )}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            }
          />
          <LandingSettingsSlider
            label="Music"
            value={Math.round(musicVolume * 100)}
            onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
          />
          <LandingSettingsSlider
            label="Sound Effects"
            value={Math.round(uiVolume * 100)}
            onChange={(value) => setCategoryVolume(AudioCategory.UI, value / 100)}
          />

          {trackName && (
            <div className={cn(SETTINGS_CONTROL_CLASS, "flex items-center gap-3 px-3 py-3")}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] border border-gold/12 bg-black/45 text-gold/55">
                <Music className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-gold/34">Now Playing</div>
                <ScrollingTrackName trackName={trackName} className="w-full overflow-hidden text-xs" />
              </div>
              <button
                type="button"
                onClick={nextTrack}
                className={cn(
                  SETTINGS_ACTION_BUTTON_CLASS,
                  "px-2.5 py-2 text-[11px] uppercase tracking-[0.16em] text-gold/58",
                )}
              >
                Skip
              </button>
            </div>
          )}
        </LandingSettingsSection>

        <LandingSettingsSection icon={Maximize2} title="Display">
          <button type="button" onClick={handleFullScreen} className={cn(SETTINGS_ACTION_BUTTON_CLASS, "w-full gap-2")}>
            {fullScreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                Enter Fullscreen
              </>
            )}
          </button>
        </LandingSettingsSection>

        <LandingSettingsSection icon={Monitor} title="Graphics">
          <div className="grid grid-cols-3 gap-2">
            {[GraphicsSettings.LOW, GraphicsSettings.MID, GraphicsSettings.HIGH].map((setting) => {
              const isActive = graphicsSetting === setting;
              return (
                <button
                  key={setting}
                  type="button"
                  disabled={isActive}
                  onClick={() => handleGraphicsSettingChange(setting)}
                  className={cn(
                    SETTINGS_CHOICE_BUTTON_BASE_CLASS,
                    isActive
                      ? "cursor-default border-gold/32 bg-gold/[0.14] text-gold"
                      : "border-gold/14 bg-black/35 text-gold/68 hover:border-gold/26 hover:bg-gold/[0.08] hover:text-gold",
                  )}
                >
                  {setting.charAt(0).toUpperCase() + setting.slice(1)}
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-gold/42">Changing graphics quality reloads the page.</p>
        </LandingSettingsSection>
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-gold/34">More settings available in-game</p>
      </div>
    </div>
  );
};
