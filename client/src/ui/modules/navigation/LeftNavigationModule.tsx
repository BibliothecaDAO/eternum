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
import { ReactComponent as Donkey } from "@/assets/icons/units/donkey-circle.svg";
import { ReactComponent as City } from "@/assets/icons/common/city.svg";
import {
  banks,
  entityDetails,
  eventLog,
  hyperstructures,
  leaderboard,
  military,
  resources,
  settings,
  trade,
  construction,
  assistant,
} from "../../components/navigation/Config";
import useUIStore from "../../../hooks/store/useUIStore";
import { useLocation } from "wouter";
import CircleButton from "../../elements/CircleButton";
import { SettingsWindow } from "../settings/Settings";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import { EventLog } from "../events/Events";
import { Banks } from "../banking/Banks";
import { Leaderboard } from "../leaderboard/LeaderBoard";
import { HyperStructures } from "../hyperstructures/Hyperstructures";
import { Resources } from "@/ui/modules/resources/Resources";
import { Military } from "@/ui/modules/military/Military";
import { EntityDetails } from "@/ui/modules/entity-details/EntityDetails";
import { Trading } from "../trade/Trading";
import { Construction } from "../construction/Construction";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { Assistant } from "../assistant/Assistant";

export const BuildingThumbs = {
  hex: "/images/buildings/thumb/question.png",
  military: "/images/buildings/thumb/military.png",
  construction: "/images/buildings/thumb/crane.png",
  trade: "/images/buildings/thumb/trade.png",
  resources: "/images/buildings/thumb/resources.png",
  banks: "/images/buildings/thumb/banks.png",
  hyperstructures: "/images/buildings/thumb/hyperstructure.png",
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: "/images/buildings/thumb/world-map.png",
  squire: "/images/buildings/thumb/squire.png",
};

export const LeftNavigationModule = () => {
  const { togglePopup, closeAllPopups, openAllPopups, isPopupOpen } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const [location, setLocation] = useLocation();
  const { moveCameraToRealm } = useUIStore();

  const { realmEntityId } = useRealmStore();

  // this could be moved up a layer
  const { realm } = useHexPosition();

  const navigation = [
    {
      button: (
        <CircleButton
          image={BuildingThumbs.hex}
          label={entityDetails}
          active={isPopupOpen(entityDetails)}
          size="xl"
          onClick={() => togglePopup(entityDetails)}
        ></CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.military}
          label={military}
          active={isPopupOpen(military)}
          size="xl"
          onClick={() => togglePopup(military)}
        ></CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.construction}
          label={construction}
          active={isPopupOpen(construction)}
          size="xl"
          onClick={() => togglePopup(construction)}
        ></CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.trade}
          label={trade}
          active={isPopupOpen(trade)}
          size="xl"
          onClick={() => togglePopup(trade)}
        >
          {/* <Donkey className="w-9 fill-current" /> */}
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.resources}
          label={resources}
          active={isPopupOpen(resources)}
          size="xl"
          onClick={() => togglePopup(resources)}
        ></CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.banks}
          label={banks}
          active={isPopupOpen(banks)}
          size="xl"
          onClick={() => togglePopup(banks)}
        ></CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.hyperstructures}
          label={hyperstructures}
          active={isPopupOpen(hyperstructures)}
          size="xl"
          onClick={() => togglePopup(hyperstructures)}
        ></CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.leaderboard}
          label={leaderboard}
          active={isPopupOpen(leaderboard)}
          size="xl"
          onClick={() => togglePopup(leaderboard)}
        ></CircleButton>
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
            openAllPopups([
              entityDetails,
              leaderboard,
              settings,
              hyperstructures,
              banks,
              resources,
              eventLog,
              military,
              construction,
            ])
          }
        >
          <Expand className="w-4" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton label={"close all popups"} size="sm" onClick={() => closeAllPopups()}>
          <Close className="w-4" />
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

  if (realmEntityId === undefined) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col py-2">
        {navigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
      </div>
      <div className="flex flex-col rounded-r-3xl space-y-2 py-2 px-4">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
      </div>
      {/* <EventLog /> */}
      <Banks />
      <Leaderboard />
      <HyperStructures />
      <SettingsWindow />
      <Resources entityId={realmEntityId} />
      <Military />
      <EntityDetails />
      <Trading />
      <Construction entityId={realmEntityId} />
      <Assistant />
    </>
  );
};
