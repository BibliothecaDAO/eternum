import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useEntityArmies } from "@/hooks/helpers/useArmies";
import { useGetMyOffers } from "@/hooks/helpers/useTrade";
import { BuildingType, QuestType } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useMemo } from "react";

import { create } from "zustand";
import { useEntities } from "../helpers/useEntities";

export enum QuestName {
  ClaimFood = "Claim Food",
  BuildFarm = "Build a Farm",
  BuildResource = "Build a Resource Facility",
  CreateTrade = "Create a Trade",
  CreateArmy = "Create an Army",
}

export interface Quest {
  name: string;
  description: string;
  steps: Step[];
  completed?: boolean;
  claimed?: boolean;
  prizes: Prize[];
}

interface Step {
  description: string;
  completed: boolean;
}

interface Prize {
  id: number;
  title: string;
}

export interface QuestStore {
  quests: Quest[] | undefined;
  setQuests: (quests: Quest[] | undefined) => void;
  currentQuest: Quest | undefined;
  setCurrentQuest: (currentQuest: Quest | undefined) => void;
  claimableQuestsLength: number;
  setClaimableQuestsLength: (claimableQuestsLength: number) => void;
}

export const useQuestStore = create<QuestStore>((set) => {
  return {
    quests: undefined,
    setQuests: (quests: Quest[] | undefined) => set({ quests }),
    currentQuest: undefined,
    setCurrentQuest: (currentQuest: Quest | undefined) => set({ currentQuest }),
    claimableQuestsLength: 0,
    setClaimableQuestsLength: (claimableQuestsLength: number) => set({ claimableQuestsLength }),
  };
});

export const useQuests = () => {
  const {
    setup: {
      components: { BuildingQuantityv2, HasClaimedStartingResources },
    },
    account: { account },
  } = useDojo();

  const setQuests = useQuestStore((state) => state.setQuests);
  const setCurrentQuest = useQuestStore((state) => state.setCurrentQuest);
  const setClaimableQuestsLength = useQuestStore((state) => state.setClaimableQuestsLength);

  const { playerRealms } = useEntities();
  const entityId = playerRealms()[0]?.entity_id;

  const farms =
    useComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(BuildingType.Farm)]))
      ?.value || 0;

  const resource =
    useComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(BuildingType.Resource)]))
      ?.value || 0;

  console.log("resource", farms);

  const orders = useGetMyOffers();

  const { entityArmies } = useEntityArmies({ entity_id: entityId || BigInt("0") });

  const quests: Quest[] = useMemo(() => {
    const updatedQuests = [
      {
        name: QuestName.ClaimFood,
        description:
          "A gift from the gods to start your journey. Take a look at your resources balance in the resources menu.",
        completed: true,
        steps: [],
        prizes: [{ id: QuestType.Food, title: "Resources Claim" }],
      },
      {
        name: QuestName.BuildFarm,
        description: "Wheat is the lifeblood of your people. Go to the construction menu and build a farm.",
        completed: farms > 0,
        steps: [],
        prizes: [
          { id: QuestType.CommonResources, title: "Common Resources" },
          { id: QuestType.UncommonResources, title: "Uncommon Resources" },
          { id: QuestType.RareResources, title: "Rare Claim" },
          { id: QuestType.UniqueResources, title: "Unique Claim" },
          { id: QuestType.LegendaryResources, title: "Legendary Claim" },
          { id: QuestType.MythicResources, title: "Mythic Claim" },
        ],
      },
      {
        name: QuestName.BuildResource,
        description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
        completed: resource > 0,
        steps: [],
        prizes: [{ id: QuestType.Trade, title: "Donkeys and Lords" }],
      },
      {
        name: QuestName.CreateTrade,
        description: "Trading is the lifeblood of Eternum. Create a trade to start your economy.",
        completed: orders.length > 0,
        steps: [],
        prizes: [{ id: QuestType.Military, title: "Claim Starting Army" }],
      },
      {
        name: QuestName.CreateArmy,
        description: "Conquest is fulfilling. Create an army to conquer your enemies.",
        completed: entityArmies.length > 0 && armyHasTroops(entityArmies),
        steps: [
          { description: "Create an army to conquer your enemies.", completed: entityArmies.length > 0 },
          {
            description: "Assign troops to your army",
            completed: armyHasTroops(entityArmies),
          },
        ],
        prizes: [{ id: QuestType.Earthenshard, title: "Claim Earthen Shard" }],
      },
    ];

    return updatedQuests.map((quest) => {
      const claimed = quest.prizes.every((prize) => {
        const value = getComponentValue(
          HasClaimedStartingResources,
          getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(prize.id)]),
        );
        return value?.claimed;
      });
      return { ...quest, claimed };
    });
  }, [farms, resource, orders, entityArmies, HasClaimedStartingResources, entityId, account.address]);

  useEffect(() => {
    setQuests(quests);
  }, []);

  useEffect(() => {
    setQuests(quests);

    const claimableQuestsLenght = quests.filter((quest) => !quest.claimed).length;
    setClaimableQuestsLength(claimableQuestsLenght);

    const currentQuest = quests.find((quest) => !quest.claimed);
    setCurrentQuest(currentQuest);
  }, [quests]);
};

const armyHasTroops = (entityArmies: ArmyInfo[]) => {
  return (
    entityArmies &&
    entityArmies[0] &&
    (Number(entityArmies[0].troops.knight_count) != 0 ||
      Number(entityArmies[0].troops.crossbowman_count) != 0 ||
      Number(entityArmies[0].troops.paladin_count) != 0)
  );
};
