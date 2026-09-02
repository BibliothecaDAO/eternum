import { ReactComponent as Next } from "@/assets/icons/common/arrow-right.svg";
import { ReactComponent as Muted } from "@/assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "@/assets/icons/common/unmuted.svg";
import { ReactComponent as DojoMark } from "@/assets/icons/dojo-mark-full-dark.svg";
import { ReactComponent as RealmsWorld } from "@/assets/icons/rw-logo.svg";
import { AudioCategory, ScrollingTrackName, useAudio, useMusicPlayer, useUISound } from "@/audio";
import { useCameraZoomStore } from "@/hooks/store/use-camera-zoom-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { LOCAL_CAMERA_ZOOM } from "@/three/constants";
import { WORLDMAP_CAMERA_ZOOM } from "@/three/scenes/worldmap-camera-view-profile";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { renderProfile, type RenderMode, writeRenderMode } from "@/three/render-profile";
import { Avatar, Button, Checkbox, RangeInput } from "@/ui/design-system/atoms";
import { Headline } from "@/ui/design-system/molecules";
import { shortcuts } from "@/ui/features/world";
import { redirectToLandingWorldSelection } from "@/ui/features/world-selector";
import { resetBootstrap } from "@/init/bootstrap";
import { useNavigate } from "react-router-dom";
import { addressToNumber } from "@/ui/utils/utils";
import { useDojo, useScreenOrientation } from "@bibliothecadao/react";
import { useState } from "react";
import { toast } from "sonner";

const RENDER_MODE_OPTIONS: { label: string; mode: RenderMode }[] = [
  { label: "Quality", mode: "quality" },
  { label: "Battery", mode: "battery" },
];

export const SETTINGS_POPOVER_ID = "settings";

/** The settings panel. It renders inside the gear's popover, so its audio, camera and guild subscriptions exist only while that is open. */
export const SettingsPanel = () => {
  const {
    account: { account },
  } = useDojo();

  const navigate = useNavigate();

  // Use full audio system for reactive state updates
  const { setCategoryVolume, setMasterVolume, setMuted, audioState } = useAudio();
  const { trackName, next: nextTrack } = useMusicPlayer();
  const worldmapZoomDistance =
    useCameraZoomStore((state) => state.worldmapDistance) ?? WORLDMAP_CAMERA_ZOOM.defaultDistance;
  const localZoomDistance = useCameraZoomStore((state) => state.localDistance) ?? LOCAL_CAMERA_ZOOM.defaultDistance;
  const setWorldmapZoomDistance = useCameraZoomStore((state) => state.setWorldmapDistance);
  const setLocalZoomDistance = useCameraZoomStore((state) => state.setLocalDistance);
  const resetCameraZoom = useCameraZoomStore((state) => state.resetToDefaults);

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
  const closePopover = usePopoverStore((state) => state.close);

  // The guilds slice is the subscription; the bridge publishes it once per ingest slice and on account change.
  const guilds = useWorldSlicesStore((state) => state.guilds);
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
    <div className="flex flex-col space-y-6 p-2">
      <div className="flex items-center justify-center">
        <Avatar size="xl" className="relative z-1" src={`/images/avatars/${addressToNumber(account.address)}.png`} />
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
                closePopover(SETTINGS_POPOVER_ID);
                togglePopup(shortcuts);
              }}
            >
              View
            </Button>
          </div>
        </section>
        {/* Video controls and the temporal render profile. */}
        <section className="space-y-3">
          <Headline>Video & Graphics</Headline>
          <div className="flex items-center space-x-2 text-xs cursor-pointer text-gray-gold" onClick={clickFullScreen}>
            <Checkbox enabled={fullScreen} />
            <div>Fullscreen</div>
          </div>

          <div className="text-xs text-gray-gold mt-2">Render Mode</div>
          <div className="flex space-x-2">
            {RENDER_MODE_OPTIONS.map(({ label, mode: nextMode }) => (
              <Button
                key={nextMode}
                disabled={renderProfile.mode === nextMode}
                variant={renderProfile.mode === nextMode ? "success" : "outline"}
                onClick={() => {
                  writeRenderMode(localStorage, nextMode);
                  window.location.reload();
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-gray-gold/70">
            Battery reduces idle and distant update frequency without changing visual detail.
          </p>
        </section>

        {/* Camera — persisted zoom per scene. Changes apply immediately to the
              active scene and are restored on every scene switch and reload. */}
        <section className="space-y-3">
          <Headline>Camera</Headline>
          <RangeInput
            title="World Map Zoom"
            fromTitle="Close"
            toTitle="Far"
            min={WORLDMAP_CAMERA_ZOOM.minDistance}
            max={WORLDMAP_CAMERA_ZOOM.maxDistance}
            value={Math.round(worldmapZoomDistance)}
            onChange={setWorldmapZoomDistance}
          />
          <RangeInput
            title="Local View Zoom"
            fromTitle="Close"
            toTitle="Far"
            min={LOCAL_CAMERA_ZOOM.minDistance}
            max={LOCAL_CAMERA_ZOOM.maxDistance}
            value={Math.round(localZoomDistance)}
            onChange={setLocalZoomDistance}
          />
          <Button size="xs" variant="outline" onClick={resetCameraZoom}>
            Reset to Default
          </Button>
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
              redundant with the window close (X) and the onboarding shortcut
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
  );
};

// ScrollingTrackName moved to MusicPlayer component
