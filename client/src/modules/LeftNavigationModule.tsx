import { ReactComponent as Settings } from "../assets/icons/common/settings.svg";
import { ReactComponent as WorldIcon } from "../assets/icons/common/world.svg";
import { ReactComponent as Coin } from "../assets/icons/common/coin.svg";
import { ReactComponent as Farm } from "../assets/icons/common/farm.svg";
import { ReactComponent as CrossSwords } from "../assets/icons/common/cross-swords.svg";
import { ReactComponent as PickAxe } from "../assets/icons/common/pick-axe.svg";
import { ReactComponent as LeaderBoard } from "../assets/icons/common/leaderboard.svg";
import { ReactComponent as Pen } from "../assets/icons/common/pen.svg";
import { ReactComponent as City } from "../assets/icons/common/city.svg";
import {
  banks,
  eventLog,
  hyperstructures,
  leaderboard,
  military,
  resources,
  settings,
} from "../components/navigation/Config";
import useUIStore from "../hooks/store/useUIStore";
import { useLocation } from "wouter";
import CircleButton from "../elements/CircleButton";
import { SettingsWindow } from "../components/navigation/Settings";
import useRealmStore from "../hooks/store/useRealmStore";
import { useGetRealm } from "../hooks/helpers/useRealm";
import { EventLog } from "../components/navigation/Events";
import { Banks } from "../components/navigation/Banks";
import { Leaderboard } from "../components/navigation/LeaderBoard";
import { HyperStructures } from "../components/navigation/Hyperstructures";
import { Resources } from "../components/navigation/Resources";
import { Military } from "../components/navigation/Military";

export const LeftNavigationModule = () => {
  const { togglePopup, closeAllPopups, openAllPopups } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const [location, setLocation] = useLocation();
  const { moveCameraToRealm } = useUIStore();

  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const navigation = [
    {
      button: (
        <div
          onClick={() => {
            if (location !== "/map") {
              setIsLoadingScreenEnabled(true);
              setTimeout(() => {
                setLocation("/map");
                moveCameraToRealm(Number(realm?.realmId), 0.01);
              }, 100);
            } else {
              moveCameraToRealm(Number(realm?.realmId));
            }
          }}
        >
          <CircleButton size="lg">
            <WorldIcon className="fill-gold" />
          </CircleButton>
        </div>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(eventLog)}>
          <Pen className="w-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(resources)}>
          <PickAxe className="w-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(banks)}>
          <Coin className="w-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(hyperstructures)}>
          <City className="w-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(leaderboard)}>
          <LeaderBoard className="w-5" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(military)}>
          <CrossSwords className="h-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          size="lg"
          onClick={() => openAllPopups([leaderboard, settings, hyperstructures, banks, resources, eventLog, military])}
        >
          O
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => closeAllPopups()}>
          X
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(settings)}>
          <Settings className="w-5" />
        </CircleButton>
      ),
    },
  ];
  return (
    <div className="flex flex-col bg-brown pr-2 rounded-r-3xl border-r-2 border-y-2 space-y-2 border-gold py-3">
      {navigation.map((a) => a.button)}

      <EventLog />
      <Banks />
      <Leaderboard />
      <HyperStructures />
      <SettingsWindow />
      <Resources />
      <Military />
    </div>
  );
};
