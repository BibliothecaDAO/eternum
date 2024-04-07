import { ReactComponent as Settings } from "@/assets/icons/common/settings.svg";
import { ReactComponent as WorldIcon } from "@/assets/icons/common/world.svg";
import { ReactComponent as Coin } from "@/assets/icons/common/coin.svg";
import { ReactComponent as Relic } from "@/assets/icons/common/relic.svg";
import { ReactComponent as Hex } from "@/assets/icons/common/hex.svg";
import { ReactComponent as Close } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as Expand } from "@/assets/icons/common/expand.svg";
import { ReactComponent as CrossSwords } from "@/assets/icons/common/cross-swords.svg";
import { ReactComponent as PickAxe } from "@/assets/icons/common/pick-axe.svg";
import { ReactComponent as LeaderBoard } from "@/assets/icons/common/leaderboard.svg";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import {
  banks,
  entityDetails,
  eventLog,
  hyperstructures,
  leaderboard,
  military,
  resources,
  settings,
} from "../../components/navigation/Config";
import useUIStore from "../../hooks/store/useUIStore";
import { useLocation } from "wouter";
import CircleButton from "../../elements/CircleButton";
import { SettingsWindow } from "../settings/Settings";
import useRealmStore from "../../hooks/store/useRealmStore";
import { useGetRealm } from "../../hooks/helpers/useRealm";
import { EventLog } from "../events/Events";
import { Banks } from "../banking/Banks";
import { Leaderboard } from "../leaderboard/LeaderBoard";
import { HyperStructures } from "../hyperstructures/Hyperstructures";
import { Resources } from "@/modules/resources/Resources";
import { Military } from "@/modules/military/Military";
import { EntityDetails } from "@/modules/entity-details/EntityDetails";

export const LeftNavigationModule = () => {
  const { togglePopup, closeAllPopups, openAllPopups, isPopupOpen } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const [location, setLocation] = useLocation();
  const { moveCameraToRealm } = useUIStore();

  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const navigation = [
    {
      button: (
        <CircleButton
          label={entityDetails}
          active={isPopupOpen(entityDetails)}
          size="lg"
          onClick={() => togglePopup(entityDetails)}
        >
          <Hex className="h-12 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton label={military} active={isPopupOpen(military)} size="lg" onClick={() => togglePopup(military)}>
          <CrossSwords className="h-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton label={eventLog} active={isPopupOpen(eventLog)} size="lg" onClick={() => togglePopup(eventLog)}>
          <Pen className="w-7 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          label={resources}
          active={isPopupOpen(resources)}
          size="lg"
          onClick={() => togglePopup(resources)}
        >
          <PickAxe className="w-6 stroke-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton label={banks} active={isPopupOpen(banks)} size="lg" onClick={() => togglePopup(banks)}>
          <Coin className="w-6 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          label={hyperstructures}
          active={isPopupOpen(hyperstructures)}
          size="lg"
          onClick={() => togglePopup(hyperstructures)}
        >
          <Relic className="w-5 fill-current" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          label={leaderboard}
          active={isPopupOpen(leaderboard)}
          size="lg"
          onClick={() => togglePopup(leaderboard)}
        >
          <LeaderBoard className="w-6" />
        </CircleButton>
      ),
    },
  ];

  const secondaryNavigation = [
    {
      button: (
        <CircleButton
          label={"expand all popups"}
          size="sm"
          onClick={() =>
            openAllPopups([entityDetails, leaderboard, settings, hyperstructures, banks, resources, eventLog, military])
          }
        >
          <Expand />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton label={"close all popups"} size="sm" onClick={() => closeAllPopups()}>
          <Close />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton active={isPopupOpen(settings)} label={"settings"} size="sm" onClick={() => togglePopup(settings)}>
          <Settings className="w-4" />
        </CircleButton>
      ),
    },
  ];

  return (
    <>
      <div className=" p-1">
        <CircleButton
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
          size="md"
        >
          <WorldIcon className="fill-gold" />
        </CircleButton>
      </div>
      <div className="flex flex-col bg-brown pr-2 rounded-r-3xl border-r-2 border-y-2 space-y-2 border-gold py-2">
        {navigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
      </div>
      <div className="flex flex-col rounded-r-3xl space-y-2 py-3 px-2">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
      </div>
      <EventLog />
      <Banks />
      <Leaderboard />
      <HyperStructures />
      <SettingsWindow />
      <Resources />
      <Military />
      <EntityDetails />
    </>
  );
};
