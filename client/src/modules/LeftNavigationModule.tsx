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

export const LeftNavigationModule = () => {
  const { togglePopup, closeAllPopups } = useUIStore();

  const navigation = [
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(eventLog)}>
          E
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(banks)}>
          B
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(hyperstructures)}>
          H
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => togglePopup(leaderboard)}>
          L
        </CircleButton>
      ),
    },
    {
      button: (
        <CircleButton size="lg" onClick={() => closeAllPopups()}>
          X
        </CircleButton>
      ),
    },
  ];
  return (
    <div className="flex flex-col bg-brown pr-2 rounded-r-3xl border-r-2 border-y-2 space-y-2 border-gold py-3">
      {navigation.map((a) => a.button)}

      <EventLog />
      <Banks />
      <Leaderboard />
      <HyperStructures />
    </div>
  );
};
