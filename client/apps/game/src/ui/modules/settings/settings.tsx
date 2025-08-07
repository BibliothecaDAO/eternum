import { ReactComponent as Copy } from "@/assets/icons/common/copy.svg";
import { ReactComponent as Next } from "@/assets/icons/common/fast-forward.svg";
import { ReactComponent as Muted } from "@/assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "@/assets/icons/common/unmuted.svg";
import { ReactComponent as Controller } from "@/assets/icons/controller.svg";
import { ReactComponent as DojoMark } from "@/assets/icons/dojo-mark-full-dark.svg";
import { ReactComponent as RealmsWorld } from "@/assets/icons/rw-logo.svg";
import { useMusicPlayer } from "@/hooks/helpers/use-music";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ToriiSetting } from "@/types";
import { GraphicsSettings, IS_FLAT_MODE } from "@/ui/config";
import { getIsBlitz } from "@/ui/constants";
import { Avatar, Button, Checkbox, RangeInput } from "@/ui/design-system/atoms";
import { Headline } from "@/ui/design-system/molecules";
import { OSWindow, settings } from "@/ui/features/world";
import { addressToNumber, displayAddress } from "@/ui/utils/utils";
import { DEFAULT_TORII_SETTING } from "@/utils/config";
import { getAddressName } from "@bibliothecadao/eternum";
import { useDojo, useGuilds, useScreenOrientation } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import * as platform from "platform";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Helper function to extract architecture from filename
const extractArchitecture = (filename: string): string | null => {
  // Common architecture patterns
  const patterns = [
    /arm64/i,
    /aarch64/i, // Often used for ARM64, especially on macOS
    /x86_64/i,
    /amd64/i, // Often used interchangeably with x86_64
    /x64/i, // Common abbreviation for x86_64/amd64
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      let arch = match[0].toLowerCase();
      // Normalize common variations
      if (arch === "aarch64") arch = "arm64";
      if (arch === "x64") arch = "amd64"; // Or 'x86_64', 'amd64' is common
      return arch;
    }
  }

  // Handle specific file types if no pattern matches
  if (filename.endsWith(".exe")) {
    // Assume amd64 for .exe if not specified, as it's most common
    return "amd64";
  }
  // Add assumption for .dmg if no explicit arch (often aarch64/arm64 on modern macOS)
  if (filename.endsWith(".dmg")) {
    return "arm64/amd64"; // Could be either, maybe default to arm64 or leave ambiguous
  }

  return null; // Return null if no architecture found
};

export const SettingsWindow = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const [download, setDownload] = useState<boolean>(false);

  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const addressName = getAddressName(ContractAddress(account.address), components);

  const [showSettings, setShowSettings] = useState(false);
  const musicLevel = useUIStore((state) => state.musicLevel);
  const effectsLevel = useUIStore((state) => state.effectsLevel);
  const setMusicLevel = useUIStore((state) => state.setMusicLevel);
  const setEffectsLevel = useUIStore((state) => state.setEffectsLevel);
  const isSoundOn = useUIStore((state) => state.isSoundOn);
  const toggleSound = useUIStore((state) => state.toggleSound);

  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());

  const initialToriiSetting = (localStorage.getItem("TORII_SETTING") as ToriiSetting) || DEFAULT_TORII_SETTING;
  const [toriiSetting, setToriiSetting] = useState<ToriiSetting>(initialToriiSetting);

  const [isFlatMode, setIsFlatMode] = useState<boolean>(() => IS_FLAT_MODE);

  // State to hold download links with names and URLs
  const [eternumLoaderDownloadLinks, setEternumLoaderDownloadLinks] = useState<string[]>([]);

  useEffect(() => {
    setToriiSetting(localStorage.getItem("TORII_SETTING") as ToriiSetting);
  }, [localStorage.getItem("TORII_SETTING")]);

  const clickFullScreen = () => {
    setFullScreen(!fullScreen);
    toggleFullScreen();
  };

  const copyToClipBoard = () => {
    navigator.clipboard.writeText(account.address);
    toast("Copied address to clipboard!");
  };

  const { trackName, next } = useMusicPlayer();

  const togglePopup = useUIStore((state) => state.togglePopup);

  const isOpen = useUIStore((state) => state.isPopupOpen(settings));

  const GRAPHICS_SETTING = (localStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings) || GraphicsSettings.HIGH;

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

  const toggleFlatMode = () => {
    setIsFlatMode((prev) => {
      const newFlatMode = !prev;
      localStorage.setItem("FLAT_MODE", newFlatMode.toString());
      window.location.reload(); // Reload the page to apply changes
      return newFlatMode;
    });
  };

  useEffect(() => {
    (async () => {
      const latestRelease = await fetch("https://api.github.com/repos/edisontim/eternum-loader/releases/latest");
      const data = await latestRelease.json();
      const assets = data.assets;

      if (platform.os?.family === "Windows") {
        setEternumLoaderDownloadLinks(
          assets.filter((asset: any) => asset.name.endsWith(".exe")).map((asset: any) => asset.browser_download_url),
        );
      }
      if (platform.os?.family === "OS X") {
        setEternumLoaderDownloadLinks(
          assets.filter((asset: any) => asset.name.endsWith(".dmg")).map((asset: any) => asset.browser_download_url),
        );
      }
      if (platform.os?.family === "Linux") {
        setEternumLoaderDownloadLinks([
          ...assets
            .filter((asset: any) => asset.name.endsWith(".deb"))
            ?.map((asset: any) => asset.browser_download_url),
          ...assets
            .filter((asset: any) => asset.name.endsWith(".rpm"))
            ?.map((asset: any) => asset.browser_download_url),
        ]);
      }
    })();
  }, [platform.os]);

  return (
    <OSWindow onClick={() => togglePopup(settings)} show={isOpen} title={settings}>
      <div className="flex flex-col space-y-6 p-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar
              onClick={() => setShowSettings(!showSettings)}
              size="xl"
              className="relative z-1"
              src={`/images/avatars/${addressToNumber(account.address)}.png`}
            />
            {addressName && <div className="px-4 text-xl border rounded border-gold">{addressName}</div>}
          </div>
          <div className="flex flex-col items-center space-y-2">
            <Controller className="w-12" />
            <div className="flex items-center space-x-2">
              <div className="cursor-pointer" onClick={copyToClipBoard}>
                {displayAddress(account.address)}
              </div>
              <Copy className="w-4 hover:text-white cursor-pointer" onClick={copyToClipBoard} />
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="flex flex-col space-y-6">
          {/* Torii Section */}
          <section className="space-y-3">
            <Headline>Torii Data source</Headline>
            {download && eternumLoaderDownloadLinks.length > 0 ? (
              <div className="flex flex-col space-y-2">
                {eternumLoaderDownloadLinks.map((linkInfo) => {
                  const arch = extractArchitecture(linkInfo);
                  return (
                    <a key={linkInfo} href={linkInfo} className="text-xs text-gray-gold mx-auto">
                      {platform.os?.family} {arch ? `(${arch})` : ""}
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-gold mx-auto">
                <Button size="xs" onClick={() => setDownload(true)}>
                  Download
                </Button>{" "}
                Realms Loader for optimal loading times.
              </div>
            )}
            <div className="flex justify-between items-center space-x-2 text-xs cursor-pointer text-gray-gold">
              <div className="flex flex-row space-x-4 items-center">
                <div
                  onClick={() => {
                    const newToriiSetting =
                      toriiSetting === ToriiSetting.Local ? ToriiSetting.Remote : ToriiSetting.Local;
                    setToriiSetting(newToriiSetting);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Checkbox enabled={toriiSetting === ToriiSetting.Local} />
                  <div>Realms Loader</div>
                </div>
                <div
                  onClick={() => {
                    const newToriiSetting =
                      toriiSetting === ToriiSetting.Local ? ToriiSetting.Remote : ToriiSetting.Local;
                    setToriiSetting(newToriiSetting);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Checkbox enabled={toriiSetting === ToriiSetting.Remote} />
                  <div>Provided</div>
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <Button
                  variant="outline"
                  size="md"
                  disabled={initialToriiSetting === toriiSetting}
                  onClick={() => {
                    localStorage.setItem("TORII_SETTING", toriiSetting);
                    window.location.reload();
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
            <div className="w-fit text-xs text-gray-gold mx-auto">Changing this setting will reload the page</div>
          </section>
          {/* Video Section */}
          <section className="space-y-3">
            <Headline>Video</Headline>
            <div
              className="flex items-center space-x-2 text-xs cursor-pointer text-gray-gold"
              onClick={clickFullScreen}
            >
              <Checkbox enabled={fullScreen} />
              <div>Fullscreen</div>
            </div>
          </section>

          {/* Graphics Section */}
          <section className="space-y-3">
            <Headline>Graphics</Headline>
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
              {isSoundOn ? (
                <Button variant="outline" onClick={() => toggleSound()}>
                  <Unmuted className="w-4 cursor-pointer fill-gold" />
                </Button>
              ) : (
                <Button variant="outline" onClick={() => toggleSound()}>
                  <Muted className="w-4 cursor-pointer fill-gold" />
                </Button>
              )}
              <ScrollingTrackName trackName={trackName} />
              <Button variant="outline" onClick={next}>
                <Next className="h-4 cursor-pointer fill-gold stroke-gold" />
              </Button>
            </div>
            <div className="space-y-2">
              <RangeInput value={musicLevel} fromTitle="Mute" onChange={setMusicLevel} title="Music" />
              <RangeInput value={effectsLevel} fromTitle="Mute" onChange={setEffectsLevel} title="Effects" />
            </div>
          </section>

          {/* Footer Section */}
          <section className="space-y-4">
            <Button onClick={() => setShowSettings(false)} variant="outline" className="text-xxs !py-1 !px-2">
              Done
            </Button>

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

            <Button
              onClick={() => {
                setShowSettings(false);
                setBlankOverlay(true);
              }}
            >
              onboarding
            </Button>
          </section>
        </div>
      </div>
    </OSWindow>
  );
};

const ScrollingTrackName = ({ trackName }: { trackName: string }) => {
  const trackNameRef = useRef<any>(null);

  useEffect(() => {
    const trackNameElement = trackNameRef.current;
    const trackNameWidth = trackNameElement.offsetWidth;
    const containerWidth = trackNameElement.parentElement.offsetWidth;

    if (trackNameWidth > containerWidth) {
      trackNameElement.style.animationDuration = `${trackNameWidth / 20}s`;
      trackNameElement.classList.add("scrolling");
    }
  }, []);

  const isBlitz = getIsBlitz();

  return (
    <div className="w-full p-1 overflow-hidden text-xs border border-gold">
      <div className="track-name" ref={trackNameRef}>
        {trackName} - {isBlitz ? "Casey Wescot" : "The Minstrels"}
      </div>
    </div>
  );
};
