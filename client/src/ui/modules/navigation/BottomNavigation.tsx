import CircleButton from "@/ui/elements/CircleButton";
import { useMemo, useState } from "react";
import { RealmListBoxes } from "@/ui/components/list/RealmListBoxes";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import {
  banks,
  leaderboard,
  military,
  resources,
  trade,
  construction,
  villagers,
} from "../../components/navigation/Config";
import { SelectPreviewBuildingMenu } from "@/ui/components/construction/SelectPreviewBuilding";

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
  villagers = "villagers",
}

export const BottomNavigation = () => {
  const [activeBar, setActiveBar] = useState<MenuEnum | null>(MenuEnum.bank);

  const toggleBar = (barName: MenuEnum) => {
    setActiveBar((currentBar) => (currentBar === barName ? null : barName));
  };

  console.log("activeBar", activeBar);
  const { hexPosition } = useQuery();
  const { moveCameraToColRow } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { togglePopup, closeAllPopups, openAllPopups, isPopupOpen } = useUIStore();
  const [location, setLocation] = useLocation();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const navigation = useMemo(() => {
    const navigation = [
      {
        name: MenuEnum.realm,
        button: (
          <CircleButton
            image="/images/buildings/thumb/realm.png"
            label="Realms"
            tooltipLocation="top"
            className="forth-step"
            active={activeBar === MenuEnum.realm}
            size="xl"
            onClick={() => toggleBar(MenuEnum.realm)}
          >
            {/* <City className="w-6 fill-current" /> */}
          </CircleButton>
        ),
      },
      {
        name: MenuEnum.worldMap,
        button: (
          <CircleButton
            className="third-step"
            tooltipLocation="top"
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
        name: MenuEnum.military,
        button: (
          <CircleButton
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
        name: MenuEnum.construction,
        button: (
          <CircleButton
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
      {
        name: MenuEnum.trade,
        button: (
          <CircleButton
            image={BuildingThumbs.trade}
            tooltipLocation="top"
            label={trade}
            active={isPopupOpen(trade)}
            size="xl"
            onClick={() => togglePopup(trade)}
          ></CircleButton>
        ),
      },
      {
        name: MenuEnum.resources,
        button: (
          <CircleButton
            tooltipLocation="top"
            image={BuildingThumbs.resources}
            label={resources}
            active={isPopupOpen(resources)}
            size="xl"
            onClick={() => togglePopup(resources)}
          ></CircleButton>
        ),
      },
      {
        name: MenuEnum.bank,
        button: (
          <CircleButton
            image={BuildingThumbs.banks}
            tooltipLocation="top"
            label={banks}
            active={isPopupOpen(banks)}
            size="xl"
            onClick={() => togglePopup(banks)}
          ></CircleButton>
        ),
      },
      {
        name: MenuEnum.leaderboard,
        button: (
          <CircleButton
            image={BuildingThumbs.leaderboard}
            tooltipLocation="top"
            label={leaderboard}
            active={isPopupOpen(leaderboard)}
            size="xl"
            onClick={() => togglePopup(leaderboard)}
          />
        ),
      },
      {
        name: MenuEnum.villagers,
        button: (
          <CircleButton
            image={BuildingThumbs.villagers}
            tooltipLocation="top"
            label={villagers}
            active={isPopupOpen(villagers)}
            size="xl"
            onClick={() => togglePopup(villagers)}
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
            item.name !== MenuEnum.trade &&
            item.name !== MenuEnum.villagers,
        )
      : navigation;
  }, [location]);

  useMemo(() => {
    setActiveBar(null);
  }, [location]);

  if (!nextBlockTimestamp) {
    return null;
  }

  return (
    <div className="flex  py-3  justify-center flex-wrap first-step relative w-full duration-300 transition-all">
      <div className=" w-full mr-4  h-full mt-4 absolute bottom-8 left-20">
        <div
          className={`w-full transition-all duration-300 overflow-auto pb-2 ${
            activeBar === MenuEnum.realm ? "h-auto" : "h-0 hidden"
          }`}
        >
          <RealmListBoxes />
        </div>
        <div
          className={`w-full transition-all duration-300  pb-2 ${
            activeBar === MenuEnum.construction ? "h-auto" : "h-0 hidden"
          }`}
        >
          <SelectPreviewBuildingMenu />
        </div>
      </div>
      <div className="w-full flex space-x-2 justify-start  pl-24">
        {navigation.map((item, index) => (
          <div className="duration-300 transition-all" key={index}>
            {item.button}
          </div>
        ))}
      </div>
    </div>
  );
};
