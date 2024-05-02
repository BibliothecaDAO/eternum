import CircleButton from "@/ui/elements/CircleButton";
import { ReactComponent as Settings } from "@/assets/icons/common/settings.svg";
import { ReactComponent as Close } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as Expand } from "@/assets/icons/common/expand.svg";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { useState } from "react";

import { RealmListBoxes } from "@/ui/components/list/RealmListBoxes";

import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";

import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
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

export const BottomNavigation = () => {
  const [activeBar, setActiveBar] = useState<null | "R" | "B" | "A">(null);

  const toggleBar = (barName: "R" | "B" | "A") => {
    if (activeBar === barName) {
      setActiveBar(null);
    } else {
      setActiveBar(barName);
    }
  };
  const { hexPosition } = useQuery();
  const { moveCameraToColRow } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { togglePopup, closeAllPopups, openAllPopups, isPopupOpen } = useUIStore();
  const [location, setLocation] = useLocation();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  if (!nextBlockTimestamp) {
    return null;
  }

  const navigation = [
    {
      name: "bar1",
      button: (
        <CircleButton
          image="/images/buildings/thumb/realm.png"
          label="Realms"
          className="forth-step"
          active={activeBar === "R"}
          size="xl"
          onClick={() => toggleBar("R")}
        >
          {/* <City className="w-6 fill-current" /> */}
        </CircleButton>
      ),
    },
    {
      name: "bar3",
      button: (
        <CircleButton
          className="third-step"
          image={BuildingThumbs.worldMap}
          label="world map"
          onClick={() => {
            if (location !== "/map") {
              setIsLoadingScreenEnabled(true);
              setTimeout(() => {
                setLocation("/map");
                if (hexPosition.col !== 0 && hexPosition.row !== 0) {
                  moveCameraToColRow(hexPosition.col, hexPosition.row, 0.01, true);
                  setTimeout(() => {
                    moveCameraToColRow(hexPosition.col, hexPosition.row, 1.5);
                  }, 10);
                }
              }, 100);
            } else {
              if (hexPosition.col !== 0 && hexPosition.row !== 0) {
                moveCameraToColRow(hexPosition.col, hexPosition.row);
              }
            }
          }}
          size="xl"
        />
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
    // {
    //   button: (
    //     <CircleButton
    //       image={BuildingThumbs.hyperstructures}
    //       label={hyperstructures}
    //       active={isPopupOpen(hyperstructures)}
    //       size="xl"
    //       onClick={() => togglePopup(hyperstructures)}
    //     ></CircleButton>
    //   ),
    // },
    {
      button: (
        <CircleButton
          image={BuildingThumbs.leaderboard}
          label={leaderboard}
          active={isPopupOpen(leaderboard)}
          size="xl"
          onClick={() => togglePopup(leaderboard)}
        />
      ),
    },
  ];

  return (
    <div className="flex  py-3  justify-center flex-wrap first-step relative">
      <div className=" w-full mr-4  h-full mt-4 absolute bottom-8 left-20">
        <div
          className={`w-full transition-all duration-300 overflow-auto pb-2 ${
            activeBar === "R" ? "h-auto" : "h-0 hidden"
          }`}
        >
          <RealmListBoxes />
        </div>
        <div
          className={`w-full transition-all duration-300 overflow-auto pb-2 ${
            activeBar === "A" ? "h-auto" : "h-0 hidden"
          }`}
        >
          armies
        </div>
      </div>
      <div className="w-full flex space-x-2 justify-start  pl-24">
        {navigation.map((item, index) => (
          <div key={index}>{item.button}</div>
        ))}
      </div>
    </div>
  );
};
