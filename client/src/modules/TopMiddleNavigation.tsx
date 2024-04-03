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
import useBlockchainStore from "../hooks/store/useBlockchainStore";
import { TIME_PER_TICK } from "../components/network/EpochCountdown";

export const TopMiddleNavigation = () => {
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  if (!nextBlockTimestamp) {
    return null;
  }

  const timeLeftBeforeNextTick = nextBlockTimestamp % TIME_PER_TICK;

  const progress = (timeLeftBeforeNextTick / TIME_PER_TICK) * 100;

  return (
    <div className="flex bg-brown rounded-b-3xl border-x-2 border-b border-gold pb-3 w-96  flex-wrap text-gold">
      <div
        className="h-8 bg-gold rounded text-brown text-center flex justify-center"
        style={{ width: `${progress}%` }}
      ></div>
      <div className="self-center">{progress.toFixed()}%</div>
    </div>
  );
};
