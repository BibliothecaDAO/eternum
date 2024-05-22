import CircleButton from "@/ui/elements/CircleButton";
import { useMemo, useState } from "react";
import { RealmListBoxes } from "@/ui/components/list/RealmListBoxes";
import { ReactComponent as Settings } from "@/assets/icons/common/settings.svg";
import { ReactComponent as Close } from "@/assets/icons/common/collapse.svg";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import {
  banks,
  leaderboard,
  military,
  resources,
  trade,
  construction,
  settings,
  quests,
} from "../../components/navigation/Config";
import { SelectPreviewBuildingMenu } from "@/ui/components/construction/SelectPreviewBuilding";
import { useTour } from "@reactour/tour";
import { useComponentValue } from "@dojoengine/react";
import { getColRowFromUIPosition, getEntityIdFromKeys } from "@/ui/utils/utils";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { ArrowDown } from "lucide-react";

export enum MenuEnum {
  realm = "realm",
  worldMap = "world-map",
  military = "military",
  construction = "construction",
  trade = "trade",
  resources = "resources",
  bank = "bank",
  hyperstructures = "hyperstructures",
  leaderboard = "leaderboard",
}

export const BottomNavigation = () => {
  const {
    setup: {
      components: { Population },
    },
  } = useDojo();

  const [activeBar, setActiveBar] = useState<MenuEnum | null>(MenuEnum.bank);

  const { realmEntityId } = useRealmStore();

  const toggleBar = (barName: MenuEnum) => {
    setActiveBar((currentBar) => (currentBar === barName ? null : barName));
  };
  const togglePopup = useUIStore((state) => state.togglePopup);
  const closeAllPopups = useUIStore((state) => state.closeAllPopups);
  const openAllPopups = useUIStore((state) => state.openAllPopups);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const { hexPosition } = useQuery();
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { setIsOpen } = useTour();

  const [location, setLocation] = useLocation();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const navigation = useMemo(() => {
    const navigation = [
      {
        name: "military",
        button: (
          <CircleButton
            className="military-selector"
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={isPopupOpen(military)}
            size="xl"
            onClick={() => togglePopup(military)}
          ></CircleButton>
        ),
      },
      {
        name: "construction",
        button: (
          <CircleButton
            className="construction-selector"
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            // active={isPopupOpen(construction)}

            active={activeBar === MenuEnum.construction}
            size="xl"
            onClick={() => toggleBar(MenuEnum.construction)}
            // onClick={() => togglePopup(construction)}
          ></CircleButton>
        ),
      },
    ];

    return location === "/map"
      ? navigation.filter(
          (item) =>
            item.name !== MenuEnum.construction &&
            item.name !== MenuEnum.resources &&
            item.name !== MenuEnum.worldMap &&
            item.name !== MenuEnum.trade,
        )
      : navigation;
  }, [location]);

  const population = useComponentValue(Population, getEntityIdFromKeys([BigInt(realmEntityId || "0")]));

  const secondaryNavigation = [
    // {
    //   button: (
    //     <CircleButton
    //       label={"expand all popups"}
    //       size="sm"
    //       tooltipLocation="right"
    //       onClick={() =>
    //         openAllPopups([
    //           entityDetails,
    //           leaderboard,
    //           settings,
    //           hyperstructures,
    //           banks,
    //           resources,
    //           eventLog,
    //           military,
    //           construction,
    //         ])
    //       }
    //     >
    //       <Expand className="w-4" />
    //     </CircleButton>
    //   ),
    // },
    // {
    //   button: (
    //     <CircleButton tooltipLocation="right" label={"close all popups"} size="sm" onClick={() => closeAllPopups()}>
    //       <Close className="w-4" />
    //     </CircleButton>
    //   ),
    // },
    {
      button: (
        <CircleButton
          tooltipLocation="top"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Settings"}
          size="lg"
          onClick={() => togglePopup(settings)}
        />
      ),
    },
    // {
    //   button: (
    //     <CircleButton
    //       tooltipLocation="top"
    //       image={BuildingThumbs.settings}
    //       active={isPopupOpen(settings)}
    //       label={"walkthrough"}
    //       size="lg"
    //       onClick={() => setIsOpen(true)}
    //     />
    //   ),
    // },
    {
      button: (
        <div className="relative">
          <CircleButton
            tooltipLocation="top"
            image={BuildingThumbs.squire}
            label={quests}
            active={isPopupOpen(quests)}
            size="lg"
            onClick={() => togglePopup(quests)}
            className="forth-step"
          />

          {population?.population == null && location !== "/map" && (
            <div className="absolute bg-brown text-gold border-gradient border -top-12 w-32 animate-bounce px-1 py-1 flex uppercase">
              <ArrowDown className="text-gold w-4 mr-3" />
              <div>Start here</div>
            </div>
          )}
        </div>
      ),
    },
    {
      button: (
        <CircleButton
          tooltipLocation="top"
          image={BuildingThumbs.leaderboard}
          label={leaderboard}
          active={isPopupOpen(leaderboard)}
          size="lg"
          onClick={() => togglePopup(leaderboard)}
        />
      ),
    },
  ];

  useMemo(() => {
    setActiveBar(null);
  }, [location]);

  if (!nextBlockTimestamp) {
    return null;
  }

  return (
    <div className="flex justify-center flex-wrap first-step relative w-full duration-300 transition-all">
      <div className="flex py-2 sixth-step">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
      </div>
    </div>
  );
};
