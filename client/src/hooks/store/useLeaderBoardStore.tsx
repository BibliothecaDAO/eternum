import { HyperstructureFinishedEvent, LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { defineQuery, getComponentValue, Has, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";
import { useGuilds } from "../helpers/useGuilds";
import useUIStore from "./useUIStore";

interface LeaderboardStore {
  finishedHyperstructures: HyperstructureFinishedEvent[];
  setFinishedHyperstructures: (val: HyperstructureFinishedEvent[]) => void;
  playersByRank: [ContractAddress, number][];
  setPlayersByRank: (val: [ContractAddress, number][]) => void;
  guildsByRank: [ID, number][];
  setGuildsByRank: (val: [ID, number][]) => void;
}

export const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    finishedHyperstructures: [],
    setFinishedHyperstructures: (val: HyperstructureFinishedEvent[]) => set({ finishedHyperstructures: val }),
    playersByRank: [],
    setPlayersByRank: (val: [ContractAddress, number][]) => set({ playersByRank: val }),
    guildsByRank: [],
    setGuildsByRank: (val: [ID, number][]) => set({ guildsByRank: val }),
  };
});

export const useSubscriptionToHyperstructureEvents = () => {
  const dojo = useDojo();
  const {
    setup: {
      components: {
        events: { HyperstructureFinished },
      },
    },
  } = dojo;

  const { getGuildFromPlayerAddress } = useGuilds();

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const [newFinishedHs, setNewFinishedHs] = useState<HyperstructureFinishedEvent | null>(null);

  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const setFinishedHyperstructures = useLeaderBoardStore((state) => state.setFinishedHyperstructures);
  const setPlayersByRank = useLeaderBoardStore((state) => state.setPlayersByRank);
  const setGuildsByRank = useLeaderBoardStore((state) => state.setGuildsByRank);

  useEffect(() => {
    const leaderboardManager = LeaderboardManager.instance(dojo);
    const playersByRank = leaderboardManager.getPlayersByRank(nextBlockTimestamp || 0);
    const guildsByRank = leaderboardManager.getGuildsByRank(nextBlockTimestamp || 0, getGuildFromPlayerAddress);
    setPlayersByRank(playersByRank);
    setGuildsByRank(guildsByRank);
  }, [nextBlockTimestamp]);

  useEffect(() => {
    if (newFinishedHs === null) return;
    setFinishedHyperstructures([...finishedHyperstructures, newFinishedHs]);
  }, [newFinishedHs]);

  useEffect(() => {
    const query = defineQuery([Has(HyperstructureFinished)], {
      runOnInit: true,
    });

    const events: HyperstructureFinishedEvent[] = [];

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, HyperstructureFinished)) {
        const event = getComponentValue(HyperstructureFinished, update.entity);
        if (!event) return;
        const finishedEvent = {
          hyperstructureEntityId: event.hyperstructure_entity_id,
          timestamp: event.timestamp,
        };
        setNewFinishedHs(finishedEvent);
        events.push(finishedEvent);
      }
    });

    setFinishedHyperstructures(events);

    return () => subscription.unsubscribe();
  }, []);
};
