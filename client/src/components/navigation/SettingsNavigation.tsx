// UNUSED - can deprecated when ready

import { useEffect, useRef, useState } from "react";
import { ReactComponent as Settings } from "../../assets/icons/common/settings.svg";
import { ReactComponent as Muted } from "../../assets/icons/common/muted.svg";
import { ReactComponent as Unmuted } from "../../assets/icons/common/unmuted.svg";
import { ReactComponent as DojoMark } from "../../assets/icons/dojo-mark-full-dark.svg";
import { ReactComponent as RealmsWorld } from "../../assets/icons/rw-logo.svg";
import { ReactComponent as Next } from "../../assets/icons/common/fast-forward.svg";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import { Headline } from "../../elements/Headline";
import Button from "../../elements/Button";
import { Checkbox } from "../../elements/Checkbox";
import { RangeInput } from "../../elements/RangeInput";
import useUIStore from "../../hooks/store/useUIStore";
import useScreenOrientation from "../../hooks/useScreenOrientation";
import { useDojo } from "../../DojoContext";
import { useRealm } from "../../hooks/helpers/useRealm";
import { useMusicPlayer } from "../../hooks/useMusic";
type SettingsComponentProps = {};

export const SettingsNavigation = ({}: SettingsComponentProps) => {
  const {
    account: { accountDisplay, account },
  } = useDojo();

  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const { getAddressName } = useRealm();

  const addressName = getAddressName(account.address);

  // const addressName = useAddressStore((state) => state.addressName);
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

  const { trackName, stop, play, isPlaying, next } = useMusicPlayer();

  return (
    <div className="flex items-center text-gold w-96 mb-2">
      <div className="flex space-x-1">
        {addressName && <div className=" self-center text-xl px-4 border rounded border-gold">{addressName}</div>}

        {isPlaying ? (
          <Button variant="outline" onClick={() => stop()}>
            <Unmuted className=" cursor-pointer fill-gold  w-4" />
          </Button>
        ) : (
          <Button variant="outline" onClick={play}>
            <Muted className=" cursor-pointer fill-gold  w-4" />
          </Button>
        )}

        <Button variant="outline" onClick={next}>
          <Next className="cursor-pointer fill-gold stroke-gold  h-4" />
        </Button>
      </div>

      {showSettings && (
        <SecondaryPopup className="top-1/3" name="settings">
          <SecondaryPopup.Head onClose={() => setShowSettings(!showSettings)}>
            <div className="flex items-center ">
              <div className="mr-0.5">Settings</div>
            </div>
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px">
            <div className="flex flex-col  space-y-2 p-3">
              <Headline>Video</Headline>
              <div
                className="flex text-xs text-gray-gold space-x-2 items-center cursor-pointer"
                onClick={clickFullScreen}
              >
                <Checkbox enabled={fullScreen} />
                <div>Fullscreen</div>
              </div>
              <Headline>Sound</Headline>
              <ScrollingTrackName trackName={trackName} />
              <RangeInput value={musicLevel} fromTitle="Mute" onChange={setMusicLevel} title="Music" />
              <RangeInput value={effectsLevel} fromTitle="Mute" onChange={setEffectsLevel} title="Effects" />
              <Button onClick={() => setShowSettings(false)} variant="outline" className="text-xxs !py-1 !px-2 mr-auto">
                Done
              </Button>
              <div className="flex space-x-3 py-3">
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
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
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
    <div className="overflow-hidden w-full text-xs border border-gold p-1">
      <div className="track-name" ref={trackNameRef}>
        {trackName} - Casey Wescot
      </div>
    </div>
  );
};
