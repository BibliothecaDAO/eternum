import Button from "../elements/Button";

import {
  Banks,
  EventLog,
  HyperStructures,
  Leaderboard,
  banks,
  eventLog,
  hyperstructures,
  leaderboard,
} from "./EventLogModule";
import useUIStore from "../hooks/store/useUIStore";
import CircleButton from "../elements/CircleButton";
import { useState } from "react";

export const BottomNavigation = () => {
  const { togglePopup, closeAllPopups } = useUIStore();

  const [buildingBar, setBuildingBar] = useState(false);

  const navigation = [
    {
      button: (
        <CircleButton size="lg" onClick={() => setBuildingBar(!buildingBar)}>
          RE
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(banks)}>
          ST
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(banks)}>
          BU
        </CircleButton>
      ),
    },
  ];
  return (
    <div className="flex bg-brown rounded-t-3xl border-x-2 border-t border-gold py-3 w-96 justify-center flex-wrap">
      <div className={`w-full transition-all duration-300 ${buildingBar ? "h-16" : "h-0"}`}>
        <div></div>
      </div>
      <div className="w-full flex space-x-2 justify-center border-t border-gold pt-2">
        {navigation.map((a) => a.button)}
      </div>
    </div>
  );
};
