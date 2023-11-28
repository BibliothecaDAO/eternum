import { useState } from "react";
import { ReactComponent as Crown } from "../assets/icons/common/crown-circle-outline.svg";
import { ReactComponent as Settings } from "../assets/icons/common/settings.svg";
import { ReactComponent as Muted } from "../assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "../assets/icons/common/unmuted.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import SettleRealmComponent from "./cityview/realm/SettleRealmComponent";
import Button from "../elements/Button";
import { Checkbox } from "../elements/Checkbox";
import { RangeInput } from "../elements/RangeInput";
import useUIStore from "../hooks/store/useUIStore";
import useScreenOrientation from "../hooks/useScreenOrientation";
import { useDojo } from "../DojoContext";
import { useAddressStore } from "../hooks/store/useAddressStore";
type SettingsComponentProps = {};

export const SettingsComponent = ({}: SettingsComponentProps) => {
  const {
    account: { accountDisplay },
  } = useDojo();

  const addressName = useAddressStore((state) => state.addressName);
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

  return (
    <div className="flex items-center text-white">
      <Crown className="mr-[6px] fill-current" />
      <div className="text-xs font-bold mr-2">{accountDisplay}</div>
      {addressName && <div className="text-xs font-bold">{addressName}</div>}
      <Settings
        onClick={() => setShowSettings(!showSettings)}
        className="ml-[6px] cursor-pointer fill-gold translate-y-1"
      />
      {isSoundOn ? (
        <Unmuted onClick={() => toggleSound()} className="ml-[6px] cursor-pointer fill-gold" />
      ) : (
        <Muted onClick={() => toggleSound()} className="ml-[6px] cursor-pointer fill-gold" />
      )}
      {showSettings && (
        <SecondaryPopup className="top-1/3" name="settings">
          <SecondaryPopup.Head onClose={() => setShowSettings(!showSettings)}>
            <div className="flex items-center">
              <div className="mr-0.5">Settings</div>
            </div>
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px">
            <div className="flex flex-col  space-y-2 p-3">
              <Headline size="big">Video</Headline>
              <div
                className="flex text-xs text-gray-gold space-x-2 items-center cursor-pointer"
                onClick={clickFullScreen}
              >
                <Checkbox enabled={fullScreen} />
                <div>Fullscreen</div>
              </div>
              <Headline size="big">Sound</Headline>
              <RangeInput value={musicLevel} fromTitle="Mute" onChange={setMusicLevel} title="Music" />
              <RangeInput value={effectsLevel} fromTitle="Mute" onChange={setEffectsLevel} title="Effects" />
              <Headline size="big">Testnet Menu</Headline>
              <div className="flex justify-center">
                <SettleRealmComponent />
              </div>
              <Button onClick={() => setShowSettings(false)} variant="outline" className="text-xxs !py-1 !px-2 mr-auto">
                Done
              </Button>
              <div className="text-xs text-white/40">
                This client is open source on{" "}
                <a className="underline" href="https://github.com/BibliothecaDAO/eternum">
                  Github
                </a>
              </div>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
