import CircleButton from "@/ui/elements/CircleButton";

import { useState } from "react";

import { RealmListBoxes } from "@/ui/components/list/RealmListBoxes";

import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";

import { useQuery } from "@/hooks/helpers/useQuery";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";

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
  ];

  return (
    <div className="flex  py-3 w-[600px] justify-center flex-wrap  relative">
      {/* <div className="absolute -left-16 top-8">
        <img className="w-32 h-32 rounded-full border-4 border-gold" src="/images/avatars/1.png" alt="" />
      </div> */}

      <div className=" w-full ml-24 mr-4  h-full mt-4">
        <div
          className={`w-full transition-all duration-300 overflow-auto pb-2 ${
            activeBar === "R" ? "h-auto" : "h-0 hidden"
          }`}
        >
          <RealmListBoxes />
        </div>
        <div
          className={`w-full transition-all duration-300 overflow-auto pb-2 ${
            activeBar === "B" ? "h-auto" : "h-0 hidden"
          }`}
        >
          {/* <SelectPreviewBuilding /> */}
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
        {navigation.map((item) => (
          <div key={item.name}>{item.button}</div>
        ))}
      </div>
    </div>
  );
};
