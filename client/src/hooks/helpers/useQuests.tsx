import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useEntityArmies } from "@/hooks/helpers/useArmies";
import { useGetMyOffers } from "@/hooks/helpers/useTrade";
import { BuildingType, QuestType } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useEntities } from "./useEntities";

export enum QuestNames {
  ClaimFood = "Claim Food",
  BuildFarm = "Build a Farm",
  BuildResource = "Build a Resource",
  CreateTrade = "Create a Trade",
  CreateArmy = "Create an Army",
}

export const useQuests = () => {
  const {
    setup: {
      components: { BuildingQuantityv2, HasClaimedStartingResources },
    },
  } = useDojo();

  const {playerRealms} = useEntities();
  const entityId = playerRealms()[0]?.entity_id;
  
  const farms =
    useComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(BuildingType.Farm)]))
      ?.value || 0;

  const resource =
    useComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(BuildingType.Resource)]))
      ?.value || 0;

  const orders = useGetMyOffers();

  const { entityArmies } = useEntityArmies({ entity_id: entityId || BigInt("0") });

  const quests = useMemo(() => {
    const updatedQuests = [
      {
        name: QuestNames.ClaimFood,
        description:
          "A gift from the gods to start your journey. Take a look at your resources balance in the resources menu.",
        completed: true,
        steps: [],
        prizes: [{ id: QuestType.Food, title: "Resources Claim" }],
      },
      {
        name: QuestNames.BuildFarm,
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
        name: QuestNames.BuildResource,
        description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
        completed: resource > 0,
        steps: [],
        prizes: [{ id: QuestType.Trade, title: "Donkeys and Lords" }],
      },
      {
        name: QuestNames.CreateTrade,
        description: "Trading is the lifeblood of Eternum. Create a trade to start your economy.",
        completed: orders.length > 0,
        steps: [],
        prizes: [{ id: QuestType.Military, title: "Claim Starting Army" }],
      },
      {
        name: QuestNames.CreateArmy,
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
  }, [farms, resource, orders, entityArmies, HasClaimedStartingResources, entityId]);

  const claimableQuests = useMemo(() => {
    return quests.filter((quest) => !quest.claimed);
  }, [quests, farms, resource, orders, entityArmies]);

  const currentQuest = useMemo(() => {
    return quests.find((quest) => !quest.claimed);
  }, [quests]);

  return {
    quests,
    hasFarm: farms > 0,
    hasResource: resource > 0,
    hasTrade: orders.length > 0,
    hasArmy: entityArmies.length > 0,
    claimableQuests,
    currentQuest,
  };
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
