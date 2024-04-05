import { ReactComponent as Settings } from "../assets/icons/common/settings.svg";
import { ReactComponent as WorldIcon } from "../assets/icons/common/world.svg";
import { banks, eventLog, hyperstructures, leaderboard, resources, settings } from "../components/navigation/Config";
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
          E
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(resources)}>
          RE
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(banks)}>
          B
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(hyperstructures)}>
          H
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(leaderboard)}>
          L
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          size="lg"
          onClick={() => openAllPopups([leaderboard, settings, hyperstructures, banks, resources, eventLog])}
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
    </div>
  );
};
