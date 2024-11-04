import { HyperstructureFinishedEvent, LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { defineQuery, getComponentValue, Has, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";
import { useContributions } from "../helpers/useContributions";

interface LeaderboardStore {
  finishedHyperstructures: HyperstructureFinishedEvent[];
  setFinishedHyperstructures: (val: HyperstructureFinishedEvent[]) => void;
}

const useLeaderBoardStore = create<LeaderboardStore>((set) => {
  return {
    finishedHyperstructures: [],
    setFinishedHyperstructures: (val: HyperstructureFinishedEvent[]) => set({ finishedHyperstructures: val }),
  };
});

export const useSubscriptionToHyperstructureEvents = () => {
  const [newFinishedHs, setNewFinishedHs] = useState<HyperstructureFinishedEvent | null>(null);
  const {
    setup: {
      components: {
        events: { HyperstructureCoOwnersChange, HyperstructureFinished },
      },
    },
  } = useDojo();

  const { getContributions } = useContributions();

  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const setFinishedHyperstructures = useLeaderBoardStore((state) => state.setFinishedHyperstructures);

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
        const parsedEvent = LeaderboardManager.instance().processHyperstructureFinishedEventData(
          event,
          getContributions,
        );
        setNewFinishedHs(parsedEvent);
        events.push(parsedEvent);
      }
    });

    setFinishedHyperstructures(events);

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const query = defineQuery([Has(HyperstructureCoOwnersChange)]);

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, HyperstructureCoOwnersChange)) {
        const event = getComponentValue(HyperstructureCoOwnersChange, update.entity);
        if (!event) return;
        LeaderboardManager.instance().processHyperstructureCoOwnersChangeEvent(event);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
};
