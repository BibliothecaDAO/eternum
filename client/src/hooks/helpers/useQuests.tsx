import { useDojo } from "@/hooks/context/DojoContext";
import { useEntityArmies } from "@/hooks/helpers/useArmies";
import { useGetMyOffers } from "@/hooks/helpers/useTrade";
import { BuildingType, QuestType } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

export const useQuests = ({ entityId }: { entityId: bigint | undefined }) => {
  const {
    setup: {
      components: { BuildingQuantityv2 },
    },
  } = useDojo();

  const farms = useMemo(() => {
    const quantity =
      getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(BuildingType.Farm)]))
        ?.value || 0;

    return quantity;
  }, [entityId]);

  const resource = useMemo(() => {
    const quantity =
      getComponentValue(
        BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(BuildingType.Resource)]),
      )?.value || 0;

    return quantity;
  }, [entityId]);

  const orders = useGetMyOffers();

  const { entityArmies } = useEntityArmies({ entity_id: entityId || BigInt("0") });

  const quests = useMemo(() => {
    return [
      {
        name: "Claim Food",
        description: "A gift from the gods to start your journey.",
        completed: true,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: QuestType.Food,
            title: "Resources Claim",
          },
        ],
      },
      {
        name: "Build a Farm",
        description: "Wheat is the lifeblood of your people. Go to the construction menu and build a farm.",
        completed: farms > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: QuestType.CommonResources,
            title: "Common Resources",
          },
          {
            id: QuestType.UncommonResources,
            title: "Uncommon Resources",
          },
          {
            id: QuestType.RareResources,
            title: "Rare Claim",
          },
          {
            id: QuestType.UniqueResources,
            title: "Unique Claim",
          },
          {
            id: QuestType.LegendaryResources,
            title: "Legendary Claim",
          },
          {
            id: QuestType.MythicResources,
            title: "Mythic Claim",
          },
        ],
      },
      {
        name: "Build a Resource",
        description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
        completed: resource > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: QuestType.Trade,
            title: "Donkeys and Lords",
          },
        ],
      },
      {
        name: "Create a Trade",
        description: "Trading is the lifeblood of Eternum. Create a trade to start your economy.",
        completed: orders.length > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: QuestType.Military,
            title: "Claim Starting Army",
          },
        ],
      },
      {
        name: "Create an Army",
        description: "Conquest is fufilling. Create an army to conquer your enemies.",
        completed: entityArmies().length > 0,
        steps: [
          {
            description: "Claim Food",
          },
          {
            description: "Build a farm",
          },
        ],
        prizes: [
          {
            id: QuestType.Earthenshard,
            title: "Claim Earthen Shard",
          },
        ],
      },
    ];
  }, [farms, resource, orders, entityArmies()]);

  const claimableQuests = useMemo(() => {
    return quests.filter((quest) => !quest.completed);
  }, [quests, farms, resource, orders, entityArmies()]);

  return {
    quests,
    hasFarm: farms > 0,
    hasResource: resource > 0,
    hasTrade: orders.length > 0,
    hasArmy: entityArmies().length > 0,
    claimableQuests,
  };
};
