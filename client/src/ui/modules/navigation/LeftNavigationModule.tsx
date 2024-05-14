import { ReactComponent as Settings } from "@/assets/icons/common/settings.svg";
import { ReactComponent as Close } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as Expand } from "@/assets/icons/common/expand.svg";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import {
  banks,
  entityDetails,
  eventLog,
  hyperstructures,
  leaderboard,
  military,
  resources,
  settings,
  construction,
} from "../../components/navigation/Config";
import useUIStore from "../../../hooks/store/useUIStore";

import CircleButton from "../../elements/CircleButton";
import { SettingsWindow } from "../settings/Settings";
import useRealmStore from "../../../hooks/store/useRealmStore";

import { Banks } from "../banking/Banks";
import { Leaderboard } from "../leaderboard/LeaderBoard";
import { HyperStructures } from "../hyperstructures/Hyperstructures";
import { Resources } from "@/ui/modules/resources/Resources";
import { Military } from "@/ui/modules/military/Military";
import { EntityDetails } from "@/ui/modules/entity-details/EntityDetails";
import { Trading } from "../trade/Trading";
import { Construction } from "../construction/Construction";
import { Assistant } from "../assistant/Assistant";
import { useTour } from "@reactour/tour";
import { Questing } from "../questing/Questing";
import { Villagers } from "../villagers/Villagers";

export const BuildingThumbs = {
  hex: "/images/buildings/thumb/question.png",
  military: "/images/buildings/thumb/sword.png",
  construction: "/images/buildings/thumb/crane.png",
  trade: "/images/buildings/thumb/trade.png",
  resources: "/images/buildings/thumb/resources.png",
  banks: "/images/buildings/thumb/banks.png",
  hyperstructures: "/images/buildings/thumb/hyperstructure.png",
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: "/images/buildings/thumb/world-map.png",
  squire: "/images/buildings/thumb/squire.png",
  villagers: "/images/buildings/thumb/villagers.png",
  question: "/images/buildings/thumb/question-wood.png",
};

export const LeftNavigationModule = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const closeAllPopups = useUIStore((state) => state.closeAllPopups);
  const openAllPopups = useUIStore((state) => state.openAllPopups);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);

  const { realmEntityId } = useRealmStore();
  const { setIsOpen } = useTour();

  const secondaryNavigation = [
    {
      button: (
        <CircleButton
          label={"expand all popups"}
          size="sm"
          tooltipLocation="right"
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
        <CircleButton tooltipLocation="right" label={"close all popups"} size="sm" onClick={() => closeAllPopups()}>
          <Close className="w-4" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          tooltipLocation="right"
          active={isPopupOpen(settings)}
          label={"settings"}
          size="sm"
          onClick={() => togglePopup(settings)}
        >
          <Settings className="w-4" />
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton
          tooltipLocation="right"
          active={isPopupOpen(settings)}
          label={"walkthrough"}
          size="sm"
          onClick={() => setIsOpen(true)}
        >
          <Refresh className="w-4 " />
        </CircleButton>
      ),
    },
  ];

  if (realmEntityId === undefined) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col space-y-2 py-2 sixth-step">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
      </div>
      {/* <EventLog /> */}
      <Villagers />
      <Banks />
      <Leaderboard />
      <HyperStructures />
      <SettingsWindow />
      <Resources entityId={realmEntityId} />
      <Military entityId={realmEntityId} />
      <EntityDetails />
      <Trading />
      <Construction entityId={realmEntityId} />
      <Assistant />
      <Questing entityId={realmEntityId} />
    </>
  );
};
