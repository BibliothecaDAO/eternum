import React, { useEffect, useState } from "react";
import { ReactComponent as Crown } from "../assets/icons/common/crown-circle-outline.svg";
import { ReactComponent as Settings } from "../assets/icons/common/settings.svg";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import SettleRealmComponent from "./cityview/realm/SettleRealmComponent";
import Button from "../elements/Button";
import { Checkbox } from "../elements/Checkbox";
import { RangeInput } from "../elements/RangeInput";
import useUIStore from "../hooks/store/useUIStore";
import useScreenOrientation from "../hooks/useScreenOrientation";
type SettingsComponentProps = {};

export const SettingsComponent = ({}: SettingsComponentProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const musicLevel = useUIStore((state) => state.musicLevel);
  const effectsLevel = useUIStore((state) => state.effectsLevel);
  const setMusicLevel = useUIStore((state) => state.setMusicLevel);
  const setEffectsLevel = useUIStore((state) => state.setEffectsLevel);

  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());

  const clickFullScreen = () => {
    setFullScreen(!fullScreen);
    toggleFullScreen();
  };

  return (
    <div className="flex items-center text-white">
      <Crown className="mr-[6px] fill-current" />
      <div className="text-xs font-bold">
        DeadlyCrow<span className="text-gold">.stark</span>
      </div>
      <Settings
        onClick={() => setShowSettings(!showSettings)}
        className="ml-[6px] cursor-pointer fill-gold translate-y-1"
      />
      {showSettings && (
        <SecondaryPopup className="top-1/3">
          <SecondaryPopup.Head>
            <div className="flex items-center">
              <div className="mr-0.5">Settings</div>
              <CloseIcon
                className="w-3 h-3 cursor-pointer fill-white"
                onClick={() => {}}
              />
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
              <RangeInput
                value={musicLevel}
                fromTitle="Mute"
                onChange={setMusicLevel}
                title="Music"
              />
              <RangeInput
                value={effectsLevel}
                fromTitle="Mute"
                onChange={setEffectsLevel}
                min={0}
                max={1}
                step={0.1}
                title="Effects"
              />
              <Headline size="big">Settling</Headline>
              <div className="flex justify-center">
                <SettleRealmComponent />
              </div>
              <Button
                onClick={() => setShowSettings(false)}
                variant="outline"
                className="text-xxs !py-1 !px-2 mr-auto"
              >
                Done
              </Button>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
