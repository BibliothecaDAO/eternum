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

export const LeftNavigationModule = () => {
  const { togglePopup, closeAllPopups } = useUIStore();

  const navigation = [
    {
      button: (
        <Button onClick={() => togglePopup(eventLog)} variant="primary">
          events
        </Button>
      ),
    },
    {
      button: (
        <Button onClick={() => togglePopup(banks)} variant="primary">
          bank
        </Button>
      ),
    },
    {
      button: (
        <Button onClick={() => togglePopup(hyperstructures)} variant="primary">
          hyperstructures
        </Button>
      ),
    },
    {
      button: (
        <Button onClick={() => togglePopup(leaderboard)} variant="primary">
          leaderboard
        </Button>
      ),
    },
    {
      button: (
        <Button onClick={() => closeAllPopups()} variant="primary">
          close all
        </Button>
      ),
    },
  ];
  return (
    <div className="flex flex-col">
      {navigation.map((a) => a.button)}

      <EventLog />
      <Banks />
      <Leaderboard />
      <HyperStructures />
    </div>
  );
};
