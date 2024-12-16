import { ReactComponent as Copy } from "@/assets/icons/common/copy.svg";
import { ReactComponent as Next } from "@/assets/icons/common/fast-forward.svg";
import { ReactComponent as Muted } from "@/assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "@/assets/icons/common/unmuted.svg";
import { ReactComponent as Controller } from "@/assets/icons/Controller.svg";
import { ReactComponent as DojoMark } from "@/assets/icons/dojo-mark-full-dark.svg";
import { ReactComponent as RealmsWorld } from "@/assets/icons/rw-logo.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { useMusicPlayer } from "@/hooks/useMusic";
import useScreenOrientation from "@/hooks/useScreenOrientation";
import { settings } from "@/ui/components/navigation/Config";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { GraphicsSettings } from "@/ui/config";
import Avatar from "@/ui/elements/Avatar";
import Button from "@/ui/elements/Button";
import { Checkbox } from "@/ui/elements/Checkbox";
import { Headline } from "@/ui/elements/Headline";
import { RangeInput } from "@/ui/elements/RangeInput";
import { addressToNumber, displayAddress } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const SettingsWindow = () => {
  const {
    account: { account },
  } = useDojo();

  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const { getAddressName } = useRealm();

  const addressName = getAddressName(ContractAddress(account.address));

  const [showSettings, setShowSettings] = useState(false);
  const musicLevel = useUIStore((state) => state.musicLevel);
  const effectsLevel = useUIStore((state) => state.effectsLevel);
  const setMusicLevel = useUIStore((state) => state.setMusicLevel);
  const setEffectsLevel = useUIStore((state) => state.setEffectsLevel);
  const isSoundOn = useUIStore((state) => state.isSoundOn);
  const toggleSound = useUIStore((state) => state.toggleSound);

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

  const GRAPHICS_SETTING = localStorage.getItem("GRAPHICS_SETTING") as GraphicsSettings || GraphicsSettings.HIGH;

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
