import { ReactComponent as Next } from "@/assets/icons/common/arrow-right.svg";
import { ReactComponent as Muted } from "@/assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "@/assets/icons/common/unmuted.svg";
import { ReactComponent as DojoMark } from "@/assets/icons/dojo-mark-full-dark.svg";
import { Controller as WalletController } from "@/ui/modules/controller/controller";
import { ReactComponent as RealmsWorld } from "@/assets/icons/rw-logo.svg";
import { AudioCategory, ScrollingTrackName, useAudio, useMusicPlayer, useUISound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { GraphicsSettings } from "@/ui/config";
import { Avatar, Button, Checkbox, RangeInput } from "@/ui/design-system/atoms";
import { Headline } from "@/ui/design-system/molecules";
import { OSWindow, settings, shortcuts } from "@/ui/features/world";
import { redirectToLandingWorldSelection } from "@/ui/features/world-selector";
import { resetBootstrap } from "@/init/bootstrap";
import { useNavigate } from "react-router-dom";
import { addressToNumber } from "@/ui/utils/utils";
import { useGuilds, useScreenOrientation } from "@bibliothecadao/react";
import { useDojo } from "@bibliothecadao/react";
import { useState } from "react";
import { toast } from "sonner";
import { RENDERER_MODE_STORAGE_KEY, usesExperimentalWebGPUThreeBuild } from "@/three/renderer-build-mode";
import { env as gameEnv } from "../../../../env";

export const SettingsWindow = () => {
  const {
    account: { account },
  } = useDojo();

  const navigate = useNavigate();

  const [showSettings, setShowSettings] = useState(false);

  // Use full audio system for reactive state updates
  const { setCategoryVolume, setMasterVolume, setMuted, audioState } = useAudio();
  const { trackName, next: nextTrack } = useMusicPlayer();
  const enableMapZoom = useUIStore((state) => state.enableMapZoom);
  const setEnableMapZoom = useUIStore((state) => state.setEnableMapZoom);

  const playToggleOn = useUISound("ui.toggle_on");
  const playToggleOff = useUISound("ui.toggle_off");

  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());
  const mode = useGameModeConfig();

  const clickFullScreen = () => {
    if (fullScreen) {
      playToggleOff();
    } else {
      playToggleOn();
    }
    setFullScreen(!fullScreen);
    toggleFullScreen();
  };

  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(settings));

  const GRAPHICS_SETTING = (localStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings) || GraphicsSettings.HIGH;

  const rendererMode = localStorage.getItem(RENDERER_MODE_STORAGE_KEY) || gameEnv.VITE_PUBLIC_RENDERER_BUILD_MODE;
  const webgpuBuildAvailable = usesExperimentalWebGPUThreeBuild(gameEnv.VITE_PUBLIC_RENDERER_BUILD_MODE);

  const guilds = useGuilds();
  const [selectedGuilds, setSelectedGuilds] = useState<string[]>(() => {
    const savedGuilds = localStorage.getItem("WHITELIST");
    return savedGuilds ? savedGuilds.split(",") : [];
  });

  const handleGuildSelect = (guildId: string) => {
    setSelectedGuilds((prev) => {
      const newGuilds = prev.includes(guildId) ? prev.filter((id) => id !== guildId) : [...prev, guildId];
      localStorage.setItem("WHITELIST", newGuilds.join(","));
      toast(prev.includes(guildId) ? "Guild removed from whitelist!" : "Guild added to whitelist!");
      return newGuilds;
    });
  };

  const handleClearGuilds = () => {
    setSelectedGuilds([]);
    localStorage.removeItem("WHITELIST");
    toast("Guild whitelist cleared!");
  };

  return (
    <OSWindow onClick={() => togglePopup(settings)} show={isOpen} title={settings} maxHeightCap={640}>
      <div className="flex flex-col space-y-6 p-6">
        {/* Header — avatar + Cartridge controller button, centered together.
            The controller already surfaces handle, address, and the wallet
            menu, so we don't render any of that a second time. */}
        <div className="flex items-center justify-center gap-4">
          <Avatar
            onClick={() => setShowSettings(!showSettings)}
            size="xl"
            className="relative z-1"
            src={`/images/avatars/${addressToNumber(account.address)}.png`}
          />
          <WalletController />
        </div>

        {/* Settings Sections */}
        <div className="flex flex-col space-y-6">
          {/* World Selection */}
          <section className="space-y-3">
            <Headline>World</Headline>
            <div className="flex items-center justify-between text-xs text-gray-gold">
              <div>Switch Game</div>
              <Button
                size="xs"
                onClick={() => {
                  toast("Redirecting to the landing page to change games…");
                  try {
                    redirectToLandingWorldSelection();
                  } catch {
                    // Redirect helper throws to terminate legacy async flows.
                  }
                }}
              >
                Change Game
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-gold">
              <div>Return Home</div>
              <Button
                size="xs"
                onClick={() => {
                  resetBootstrap();
                  navigate("/");
                }}
              >
                Home
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-gold">
              <div>Keyboard Shortcuts</div>
              <Button
                size="xs"
                onClick={() => {
                  togglePopup(settings);
                  togglePopup(shortcuts);
                }}
              >
                View
              </Button>
            </div>
          </section>
          {/* Video & Graphics — combined section. Video toggles (fullscreen,
              map zoom) sit at the top, then quality tier, then renderer mode
              when WebGPU is available. */}
          <section className="space-y-3">
            <Headline>Video & Graphics</Headline>
            <div
              className="flex items-center space-x-2 text-xs cursor-pointer text-gray-gold"
              onClick={clickFullScreen}
            >
              <Checkbox enabled={fullScreen} />
              <div>Fullscreen</div>
            </div>
            <div
              className="flex items-center space-x-2 text-xs cursor-pointer text-gray-gold"
              onClick={() => {
                if (enableMapZoom) {
                  playToggleOff();
                } else {
                  playToggleOn();
                }
                setEnableMapZoom(!enableMapZoom);
              }}
            >
              <Checkbox enabled={enableMapZoom} />
              <div>Enable Map Zoom</div>
            </div>

            <div className="text-xs text-gray-gold mt-2">Quality</div>
            <div className="flex space-x-2">
              <Button
                disabled={GRAPHICS_SETTING === GraphicsSettings.LOW}
                variant={GRAPHICS_SETTING === GraphicsSettings.LOW ? "success" : "outline"}
                onClick={() => {
                  localStorage.setItem("GRAPHICS_SETTING", GraphicsSettings.LOW);
                  window.location.reload();
                }}
              >
                Low
              </Button>
              <Button
                disabled={GRAPHICS_SETTING === GraphicsSettings.MID}
                variant={GRAPHICS_SETTING === GraphicsSettings.MID ? "success" : "outline"}
                onClick={() => {
                  localStorage.setItem("GRAPHICS_SETTING", GraphicsSettings.MID);
                  window.location.reload();
                }}
              >
                Medium
              </Button>
              <Button
                disabled={GRAPHICS_SETTING === GraphicsSettings.HIGH}
                variant={GRAPHICS_SETTING === GraphicsSettings.HIGH ? "success" : "outline"}
                onClick={() => {
                  localStorage.setItem("GRAPHICS_SETTING", GraphicsSettings.HIGH);
                  window.location.reload();
                }}
              >
                High
              </Button>
            </div>
            {webgpuBuildAvailable && (
              <>
                <div className="text-xs text-gray-gold mt-2">Renderer</div>
                <div className="flex space-x-2">
                  <Button
                    disabled={rendererMode === "legacy-webgl"}
                    variant={rendererMode === "legacy-webgl" ? "success" : "outline"}
                    onClick={() => {
                      localStorage.setItem(RENDERER_MODE_STORAGE_KEY, "legacy-webgl");
                      window.location.reload();
                    }}
                  >
                    WebGL
                  </Button>
                  <Button
                    disabled={rendererMode === "experimental-webgpu-auto"}
                    variant={rendererMode === "experimental-webgpu-auto" ? "success" : "outline"}
                    onClick={() => {
                      localStorage.setItem(RENDERER_MODE_STORAGE_KEY, "experimental-webgpu-auto");
                      window.location.reload();
                    }}
                  >
                    WebGPU
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* Guild Section */}
          <section className="space-y-3">
            <Headline>Whitelist Guilds</Headline>
            <div className="flex flex-col space-y-3">
              <div className="flex flex-wrap gap-2">
                {guilds.map((guild) => (
                  <Button
                    size="xs"
                    key={guild.entityId}
                    variant={selectedGuilds.includes(guild.entityId.toString()) ? "success" : "outline"}
                    onClick={() => handleGuildSelect(guild.entityId.toString())}
                  >
                    {guild.name}
                  </Button>
                ))}
              </div>
              {selectedGuilds.length > 0 && (
                <Button size="xs" variant="danger" onClick={handleClearGuilds} className="self-start">
                  Clear All
                </Button>
              )}
            </div>
          </section>

          {/* Sound Section */}
          <section className="space-y-3">
            <Headline>Sound</Headline>
            <div className="flex space-x-2">
              {audioState && !audioState.muted ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    playToggleOff();
                    setMuted(true);
                  }}
                >
                  <Unmuted className="w-4 cursor-pointer fill-gold" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setMuted(false);
                    playToggleOn();
                  }}
                >
                  <Muted className="w-4 cursor-pointer fill-gold" />
                </Button>
              )}
              <ScrollingTrackName trackName={trackName || "Loading..."} trackArtist={mode.audio.trackArtist} />
              <Button variant="outline" onClick={nextTrack}>
                <Next className="w-2 cursor-pointer fill-gold" />
              </Button>
            </div>
            <div className="space-y-2">
              <RangeInput
                value={Math.round((audioState?.masterVolume || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setMasterVolume(value / 100)}
                title="Master Volume"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.MUSIC] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
                title="Music"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.UI] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.UI, value / 100)}
                title="UI Effects"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.COMBAT] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.COMBAT, value / 100)}
                title="Combat Effects"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.RESOURCE] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.RESOURCE, value / 100)}
                title="Resource Effects"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.BUILDING] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.BUILDING, value / 100)}
                title="Building Effects"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.AMBIENT] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.AMBIENT, value / 100)}
                title="Ambient"
              />
              <RangeInput
                value={Math.round((audioState?.categoryVolumes[AudioCategory.ENVIRONMENT] || 0) * 100)}
                fromTitle="Mute"
                onChange={(value) => setCategoryVolume(AudioCategory.ENVIRONMENT, value / 100)}
                title="Weather"
              />
            </div>
          </section>

          {/* Footer — credits + outbound links only. The "Done" button is
              redundant with the OSWindow close (X) and the onboarding shortcut
              was only useful at first-run. */}
          <section className="space-y-4">
            <div className="flex space-x-4">
              <a target="_blank" href="https://realms.world">
                <RealmsWorld className="w-16" />
              </a>
              <a href="https://www.dojoengine.org/en/">
                <DojoMark className="w-16" />
              </a>
            </div>

            <div className="text-xs text-white/40">
              Built by{" "}
              <a className="underline" href="https://realms.world">
                Realms.World
              </a>
              , powered by{" "}
              <a className="underline" href="https://www.dojoengine.org/en/">
                dojo
              </a>{" "}
              <br /> Fork and modify this client on{" "}
              <a className="underline" href="https://github.com/BibliothecaDAO/eternum">
                Github
              </a>
            </div>
          </section>
        </div>
      </div>
    </OSWindow>
  );
};

// ScrollingTrackName moved to MusicPlayer component
