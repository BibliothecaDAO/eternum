import CircleButton from "@/ui/elements/CircleButton";
import { useMemo, useState } from "react";
import { RealmListBoxes } from "@/ui/components/list/RealmListBoxes";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { banks, leaderboard, military, resources, trade, construction } from "../../components/navigation/Config";
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
}

export const BottomNavigation = () => {
  const [activeBar, setActiveBar] = useState<MenuEnum | null>(MenuEnum.bank);

  const toggleBar = (barName: MenuEnum) => {
    setActiveBar((currentBar) => (currentBar === barName ? null : barName));
  };

  const { hexPosition } = useQuery();
  const { moveCameraToColRow } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { togglePopup, closeAllPopups, openAllPopups, isPopupOpen } = useUIStore();
  const [location, setLocation] = useLocation();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const navigation = useMemo(() => {
    const navigation = [
      {
        name: "world-map",
        button: (
          <CircleButton
            className="world-selector"
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
        name: "realm",
        button: (
          <CircleButton
            className="realm-selector"
            image="/images/buildings/thumb/realm.png"
            label="Realms"
            tooltipLocation="top"
            active={activeBar === MenuEnum.realm}
            size="xl"
            onClick={() => toggleBar(MenuEnum.realm)}
          >
            {/* <City className="w-6 fill-current" /> */}
          </CircleButton>
        ),
      },

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
      {
        name: "trade",
        button: (
          <CircleButton
            className="trade-selector"
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
        name: "resources",
        button: (
          <CircleButton
            className="resources-selector"
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
        name: "bank",
        button: (
          <CircleButton
            className="banking-selector"
            image={BuildingThumbs.banks}
            tooltipLocation="top"
            label={banks}
            active={isPopupOpen(banks)}
            size="xl"
            onClick={() => togglePopup(banks)}
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

  useMemo(() => {
    setActiveBar(null);
  }, [location]);

  if (!nextBlockTimestamp) {
    return null;
  }

  return (
    <div className="flex  py-3  justify-center flex-wrap first-step relative w-full duration-300 transition-all">
      <div>
        <div className=" w-full mr-4  h-full mt-4 absolute bottom-8 left-20">
          <div
            className={`w-full transition-all duration-300 overflow-auto pb-2 justify-center flex ${
              activeBar === MenuEnum.realm ? "h-auto" : "h-0 hidden"
            }`}
          >
            <RealmListBoxes />
          </div>
          <div
            className={` transition-all duration-300 justify-center flex pb-2 ${
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
    </div>
  );
};
