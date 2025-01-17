import { ReactComponent as Copy } from "@/assets/icons/common/copy.svg";
import { ReactComponent as Next } from "@/assets/icons/common/fast-forward.svg";
import { ReactComponent as Muted } from "@/assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "@/assets/icons/common/unmuted.svg";
import { ReactComponent as Controller } from "@/assets/icons/controller.svg";
import { ReactComponent as DojoMark } from "@/assets/icons/dojo-mark-full-dark.svg";
import { ReactComponent as RealmsWorld } from "@/assets/icons/rw-logo.svg";
import { settings } from "@/ui/components/navigation/config";
import { OSWindow } from "@/ui/components/navigation/os-window";
import { GraphicsSettings, IS_FLAT_MODE } from "@/ui/config";
import Avatar from "@/ui/elements/avatar";
import Button from "@/ui/elements/button";
import { Checkbox } from "@/ui/elements/checkbox";
import { Headline } from "@/ui/elements/headline";
import { RangeInput } from "@/ui/elements/range-input";
import { addressToNumber, currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import { ContractAddress, getAddressName } from "@bibliothecadao/eternum";
import { useDojo, useGuilds, useMusicPlayer, useScreenOrientation, useUIStore } from "@bibliothecadao/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const SettingsWindow = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const addressName = getAddressName(ContractAddress(account.address), components);

  const [showSettings, setShowSettings] = useState(false);
  const musicLevel = useUIStore((state) => state.musicLevel);
  const effectsLevel = useUIStore((state) => state.effectsLevel);
  const setMusicLevel = useUIStore((state) => state.setMusicLevel);
  const setEffectsLevel = useUIStore((state) => state.setEffectsLevel);
  const isSoundOn = useUIStore((state) => state.isSoundOn);
  const toggleSound = useUIStore((state) => state.toggleSound);

  const getCurrentDonkeyWeightMinimum = () => {
    return Number(localStorage.getItem("WEIGHT_MINIMUM") || 0);
  };

  const [donkeyWeightLimit, setDonkeyWeightLimit] = useState(getCurrentDonkeyWeightMinimum());

  useEffect(() => {
    localStorage.setItem("WEIGHT_MINIMUM", donkeyWeightLimit.toString());
  }, [donkeyWeightLimit]);

  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());

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

  const { useGuildQuery } = useGuilds();
  const { guilds } = useGuildQuery();
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

  const [isFlatMode, setIsFlatMode] = useState<boolean>(() => IS_FLAT_MODE);

  const toggleFlatMode = () => {
    setIsFlatMode((prev) => {
      const newFlatMode = !prev;
      localStorage.setItem("FLAT_MODE", newFlatMode.toString());
      window.location.reload(); // Reload the page to apply changes
      return newFlatMode;
    });
  };

  return (
    <OSWindow onClick={() => togglePopup(settings)} show={isOpen} title={settings}>
      <div className="flex justify-between p-4">
        <div className="relative">
          <Avatar
            onClick={() => setShowSettings(!showSettings)}
            size="xl"
            className="relative z-1"
            src={`/images/avatars/${addressToNumber(account.address)}.png`}
          />
        </div>
        {addressName && <div className="self-center px-4 mx-2 text-xl border rounded border-gold">{addressName}</div>}
        <div className="flex flex-col items-center">
          <Controller className="w-12" />
          <div className="flex flex-row">
            <div className="self-center mx-1" onClick={copyToClipBoard}>
              {displayAddress(account.address)}
            </div>
            <Copy className="w-4 mx-1 hover:text-white" onClick={copyToClipBoard} />
          </div>
        </div>
      </div>
      <div className="flex flex-col p-3 space-y-2">
        <Headline>Video</Headline>
        <div className="flex items-center space-x-2 text-xs cursor-pointer text-gray-gold" onClick={clickFullScreen}>
          <Checkbox enabled={fullScreen} />
          <div>Fullscreen</div>
        </div>
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
        <div className="flex items-center space-x-2 text-xs cursor-pointer text-gray-gold" onClick={toggleFlatMode}>
          <Checkbox enabled={isFlatMode} />
          <div>Flat Mode</div>
        </div>

        <div className="flex flex-col gap-2">
          <h5>Whitelist guilds</h5>
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

        <RangeInput value={musicLevel} fromTitle="Mute" onChange={setMusicLevel} title="Music" />
        <RangeInput value={effectsLevel} fromTitle="Mute" onChange={setEffectsLevel} title="Effects" />

        <Headline>Donkey Settings</Headline>
        <RangeInput
          value={donkeyWeightLimit}
          min={0}
          max={100000}
          fromTitle="0"
          toTitle={currencyIntlFormat(100000)}
          onChange={setDonkeyWeightLimit}
          title={`Minimum Weight: ${donkeyWeightLimit} kg`}
        />

        <Button onClick={() => setShowSettings(false)} variant="outline" className="text-xxs !py-1 !px-2 mr-auto">
          Done
        </Button>
        <div className="flex py-3 space-x-3">
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

  return (
    <div className="w-full p-1 overflow-hidden text-xs border border-gold">
      <div className="track-name" ref={trackNameRef}>
        {trackName} - Casey Wescot
      </div>
    </div>
  );
};
