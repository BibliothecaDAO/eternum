import Avatar from "../../elements/Avatar";
import CircleButton from "../../elements/CircleButton";
import { ReactComponent as WorldIcon } from "../../assets/icons/common/world.svg";
import { ReactComponent as ForwardBurgerIcon } from "../../assets/icons/common/forward-burger.svg";
import clsx from "clsx";
import { RealmSwitch } from "../cityview/RealmSwitch";
import { Link, useLocation } from "wouter";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { addressToNumber } from "../../utils/utils";
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

import useScreenOrientation from "../../hooks/useScreenOrientation";

import { useRealm } from "../../hooks/helpers/useRealm";
import { useMusicPlayer } from "../../hooks/useMusic";

const NavgationComponent = () => {
  const {
    account: { account },
  } = useDojo();
  const { trackName, stop, play, isPlaying, next } = useMusicPlayer();

  const { toggleFullScreen, isFullScreen } = useScreenOrientation();
  const [fullScreen, setFullScreen] = useState<boolean>(isFullScreen());
  const moveCameraToWorldMapView = useUIStore((state) => state.moveCameraToWorldMapView);
  const musicLevel = useUIStore((state) => state.musicLevel);
  const effectsLevel = useUIStore((state) => state.effectsLevel);
  const setMusicLevel = useUIStore((state) => state.setMusicLevel);
  const setEffectsLevel = useUIStore((state) => state.setEffectsLevel);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const isSideMenuOpened = useUIStore((state) => state.isSideMenuOpened);
  const toggleSideMenu = useUIStore((state) => state.toggleSideMenu);
  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const [location] = useLocation();

  const { getAddressName } = useRealm();

  const addressName = getAddressName(account.address);

  const [showSettings, setShowSettings] = useState(false);

  const clickFullScreen = () => {
    setFullScreen(!fullScreen);
    toggleFullScreen();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Avatar
          onClick={() => setShowSettings(!showSettings)}
          size="xl"
          className="relative z-1"
          src={`/images/avatars/${addressToNumber(account.address)}.png`}
        />
      </div>

      <Link
        href="/map"
        onClick={() => {
          if (location !== "/map") setIsLoadingScreenEnabled(true);
          moveCameraToWorldMapView();
        }}
      >
        <CircleButton
          size="md"
          className={clsx("absolute z-0 text-[10px]", "top-0 left-16 ml-3", location.includes("/map") && "text-white")}
        >
          <WorldIcon className="fill-gold" />
        </CircleButton>
      </Link>

      <CircleButton
        onClick={() => toggleSideMenu()}
        size="md"
        className={clsx("absolute z-0 text-[10px]", "top-16 mt-3")}
      >
        <ForwardBurgerIcon
          className={clsx("fill-current duration-300 transition-transform", isSideMenuOpened && "rotate-180")}
        />
      </CircleButton>
      <RealmSwitch className={clsx("absolute z-0 text-[10px]", "top-20 left-16 -ml-2 -mt-5")} />

      {showSettings && (
        <SecondaryPopup className="top-1/3 text-gold" name="settings">
          <SecondaryPopup.Head onClose={() => setShowSettings(!showSettings)}>
            <div className="flex items-center ">
              <div className="mr-0.5">Settings</div>
            </div>
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px">
            <div className="flex space-x-1 p-4">
              {addressName && <div className=" self-center text-xl px-4 border rounded border-gold">{addressName}</div>}
            </div>
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

              <div className="flex p-1">
                {isPlaying ? (
                  <Button variant="outline" onClick={() => stop()}>
                    <Unmuted className=" cursor-pointer fill-gold  w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" onClick={play}>
                    <Muted className=" cursor-pointer fill-gold  w-4" />
                  </Button>
                )}

                <ScrollingTrackName trackName={trackName} />
                <Button variant="outline" onClick={next}>
                  <Next className="cursor-pointer fill-gold stroke-gold  h-4" />
                </Button>
              </div>

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
    <div className="overflow-hidden w-full text-xs border border-gold rounded  p-1 flex">
      <div className="track-name self-center" ref={trackNameRef}>
        {trackName} - Casey Wescot
      </div>
    </div>
  );
};

export default NavgationComponent;
