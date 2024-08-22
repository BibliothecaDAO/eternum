import { HyperstructureFinishedEvent, LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { ConfigManager, ContractAddress, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useRef, useState } from "react";
import { Subscription } from "rxjs";
import { create } from "zustand";
import { useDojo } from "../context/DojoContext";
import { useContributions } from "../helpers/useContributions";

function getResourceMultiplier(resourceType: ResourcesIds): number {
  const configManager = ConfigManager.instance();

  return configManager.getConfig().ResourceMultipliers[resourceType];
}

function computeContributionPoints(totalPoints: number, qty: number, resourceType: ResourcesIds): number {
  const configManager = ConfigManager.instance();
  const totalContributableAmount = configManager.getTotalContributableAmount();
  const resourcePrecision = configManager.getResourcePrecision();

  const effectiveContribution = (qty / resourcePrecision) * getResourceMultiplier(resourceType);
  const points = (effectiveContribution / totalContributableAmount) * totalPoints;
  return points;
}

export const calculateShares = (contributions: any[]) => {
  let points = 0;
  contributions.forEach((contribution) => {
    points += computeContributionPoints(1, Number(contribution.amount), contribution.resource_type);
  });
  return points;
};

interface Rankable {
  totalPoints: number;
  rank: number;
}

export interface PlayerPointsLeaderboardInterface {
  address: ContractAddress;
  addressName: string;
  order: string;
  totalPoints: number;
  isYours: boolean;
  rank: number;
}

export interface GuildPointsLeaderboardInterface {
  guildEntityId: ID;
  name: string;
  totalPoints: number;
  isYours: boolean;
  rank: number;
}

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
      updates: {
        eventUpdates: { createHyperstructureFinishedEvents, createHyperstructureCoOwnerChangeEvents },
      },
    },
  } = useDojo();

  const { getContributions } = useContributions();

  const subEventFinishedCreated = useRef<boolean>(false);
  const eventFinishedSubscriptionRef = useRef<Subscription | undefined>();

  const subEventCoOwnerChangedCreated = useRef<boolean>(false);
  const eventCoOwnerChangedSubscriptionRef = useRef<Subscription | undefined>();

  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const setFinishedHyperstructures = useLeaderBoardStore((state) => state.setFinishedHyperstructures);

  useEffect(() => {
    if (newFinishedHs === null) return;
    setFinishedHyperstructures([...finishedHyperstructures, newFinishedHs]);
  }, [newFinishedHs]);

  useEffect(() => {
    if (!createHyperstructureFinishedEvents) return;

    const subscription = async () => {
      const observable = await createHyperstructureFinishedEvents();
      let events: HyperstructureFinishedEvent[] = [];
      const sub = observable.subscribe((event) => {
        if (event) {
          const parsedEvent: HyperstructureFinishedEvent =
            LeaderboardManager.instance().processHyperstructureFinishedEventData(event, getContributions);
          setNewFinishedHs(parsedEvent);
          events.push(parsedEvent);
        }
      });
      setFinishedHyperstructures(events);

      eventFinishedSubscriptionRef.current = sub;
    };

    if (subEventFinishedCreated.current) return;

    subEventFinishedCreated.current = true;
    subscription();

    return () => {
      eventFinishedSubscriptionRef.current?.unsubscribe();
      subEventFinishedCreated.current = false;
    };
  }, []);

  useEffect(() => {
    if (!createHyperstructureCoOwnerChangeEvents) return;

    const subscription = async () => {
      const observable = await createHyperstructureCoOwnerChangeEvents();
      const sub = observable.subscribe((event) => {
        if (event) {
          LeaderboardManager.instance().processHyperstructureCoOwnersChangeEvent(event);
        }
      });

      eventCoOwnerChangedSubscriptionRef.current = sub;
    };

    if (subEventCoOwnerChangedCreated.current) return;

    subEventCoOwnerChangedCreated.current = true;
    subscription();

    return () => {
      eventCoOwnerChangedSubscriptionRef.current?.unsubscribe();
      subEventCoOwnerChangedCreated.current = false;
    };
  }, []);
};
