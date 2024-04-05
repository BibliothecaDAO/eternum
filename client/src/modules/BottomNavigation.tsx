import useUIStore from "../hooks/store/useUIStore";
import CircleButton from "../elements/CircleButton";
import { useState } from "react";

import { RealmListBoxes } from "../components/cityview/RealmListBoxes";
import { SelectPreviewBuilding } from "../components/cityview/hexception/SelectPreviewBuilding";

export const BottomNavigation = () => {
  const [activeBar, setActiveBar] = useState<null | "R" | "B" | "A">(null);

  const toggleBar = (barName: "R" | "B" | "A") => {
    if (activeBar === barName) {
      setActiveBar(null);
    } else {
      setActiveBar(barName);
    }
  };

  const navigation = [
    {
      name: "bar1",
      button: (
        <CircleButton size="lg" onClick={() => toggleBar("R")}>
          R
        </CircleButton>
      ),
    },
    {
      name: "bar2",
      button: (
        <CircleButton size="lg" onClick={() => toggleBar("B")}>
          B
        </CircleButton>
      ),
    },
    {
      name: "bar3",
      button: (
        <CircleButton size="lg" onClick={() => toggleBar("A")}>
          A
        </CircleButton>
      ),
    },
  ];

  return (
    <div className="flex bg-brown rounded-t-3xl border-x-2 border-t border-gold py-3 w-[600px] justify-center flex-wrap">
      {/* Conditionally render bars based on the activeBar state */}
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
        <SelectPreviewBuilding />
      </div>
      <div
        className={`w-full transition-all duration-300 overflow-auto pb-2 ${
          activeBar === "A" ? "h-auto" : "h-0 hidden"
        }`}
      >
        armies
      </div>
      <div className="w-full flex space-x-2 justify-center border-t border-gold pt-2">
        {navigation.map((item) => item.button)}
      </div>
    </div>
  );
};
