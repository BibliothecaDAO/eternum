import { useCallback, useEffect, useMemo, useState } from "react";
import { BuildingType, QuestType, StructureType } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEntities } from "./useEntities";
import { ArmyInfo, useArmiesByEntityOwner } from "./useArmies";
import { useGetMyOffers } from "./useTrade";
import { getPillageEvents } from "@/dojo/events/pillageEventQueries";

export enum QuestName {
  Settle = "Settle",
  BuildFarm = "Build a Farm",
  BuildResource = "Build a Resource Facility",
  CreateTrade = "Create a Trade",
  CreateArmy = "Create an Army",
  Travel = "Travel with your Army",
  BuildWorkersHut = "Build a workers hut",
  Market = "Build a market",
  Pillage = "Pillage a structure",
  Mine = "Discover an earthenshard mine",
  Contribution = "Contribute to a hyperstructure",
  Hyperstructure = "Build a hyperstructure",
}

const questPrize = new Map<QuestName, Prize[]>([
  [QuestName.Settle, [{ id: QuestType.Food, title: "Common Resources" }]],
  [
    QuestName.BuildFarm,
    [
      { id: QuestType.CommonResources, title: "Common Resources" },
      { id: QuestType.UncommonResources, title: "Uncommon Resources" },
      { id: QuestType.RareResources, title: "Rare Resources" },
      { id: QuestType.UniqueResources, title: "Unique Resources" },
      { id: QuestType.LegendaryResources, title: "Legendary Resources" },
      { id: QuestType.MythicResources, title: "Mythic Resources" },
    ],
  ],
  [QuestName.BuildResource, [{ id: QuestType.Trade, title: "Donkeys and Lords" }]],
  [QuestName.CreateTrade, [{ id: QuestType.Military, title: "Claim Starting Army" }]],
  [QuestName.CreateArmy, [{ id: QuestType.Earthenshard, title: "Claim Earthen Shard" }]],
  [QuestName.Travel, [{ id: QuestType.Travel, title: "Travel" }]],
  [QuestName.BuildWorkersHut, [{ id: QuestType.Population, title: "Population" }]],
  [QuestName.Market, [{ id: QuestType.Market, title: "Market" }]],
  [QuestName.Pillage, [{ id: QuestType.Pillage, title: "Pillage" }]],
  [QuestName.Mine, [{ id: QuestType.Mine, title: "Mine" }]],
  [QuestName.Contribution, [{ id: QuestType.Contribution, title: "Contribution" }]],
  [QuestName.Hyperstructure, [{ id: QuestType.Hyperstructure, title: "Hyperstructure" }]],
]);

export interface Quest {
  name: QuestName;
  description: string;
  steps: string[];
  prizes: Prize[];
  depth: number;
  status: QuestStatus;
}

export interface Prize {
  id: QuestType;
  title: string;
}

export enum QuestStatus {
  InProgress,
  Completed,
  Claimed,
}

export const useQuests = () => {
  const {
    buildingQuantities,
    entityArmies,
    orders,
    pillageHistoryLength,
    hasTroops,
    hasTraveled,
    fragmentMines,
    hyperstructures,
    hyperstructureContributions,
  } = useQuestDependencies();

  const { questClaimStatus } = useQuestClaimStatus();

  const settleQuest = useMemo(() => {
    return {
      name: QuestName.Settle,
      description: "A gift of food from the gods",
      steps: ["Settle your first Realm"],
      prizes: questPrize.get(QuestName.Settle) || [],
      depth: 0,
      status: questClaimStatus[QuestName.Settle] ? QuestStatus.Claimed : QuestStatus.Completed,
    };
  }, [questClaimStatus[QuestName.Settle]]);

  const buildFarmQuest = useMemo(
    () => ({
      name: QuestName.BuildFarm,
      description: "Wheat is the lifeblood of your people. Go to the construction menu and build a farm",
      status:
        buildingQuantities.farms > 0
          ? questClaimStatus[QuestName.BuildFarm]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [
        "Navigate to the construction menu",
        "Select the 'Farm' card",
        "Left click on a hex to build it, or right click to cancel",
      ],
      prizes: questPrize.get(QuestName.BuildFarm) || [],
      depth: 1,
    }),
    [questClaimStatus[QuestName.BuildFarm], buildingQuantities.farms],
  );

  const buildResourceQuest = useMemo(
    () => ({
      name: QuestName.BuildResource,
      description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently",
      status:
        buildingQuantities.resource > 0
          ? questClaimStatus[QuestName.BuildResource]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [
        "Navigate to the construction menu",
        "Navigate to the 'Resources' tab and select a resource card",
        "Left click on a hex to build it, or right click to cancel",
      ],
      prizes: questPrize.get(QuestName.BuildResource) || [],
      depth: 2,
    }),
    [questClaimStatus[QuestName.BuildResource], buildingQuantities.resource],
  );

  const createTradeQuest = useMemo(
    () => ({
      name: QuestName.CreateTrade,
      description: "Trading is the lifeblood of Eternum. Create a trade to start your economy",
      status:
        orders.length > 0
          ? questClaimStatus[QuestName.CreateTrade]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [],
      prizes: questPrize.get(QuestName.CreateTrade) || [],
      depth: 3,
    }),
    [questClaimStatus[QuestName.CreateTrade], orders],
  );

  const createArmyQuest = useMemo(
    () => ({
      name: QuestName.CreateArmy,
      description: "Conquest is fulfilling. Create an army to conquer your enemies",
      status:
        entityArmies.length > 0 && hasTroops
          ? questClaimStatus[QuestName.CreateArmy]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: ["Create an army to conquer your enemies", "Assign troops to your army"],
      prizes: questPrize.get(QuestName.CreateArmy) || [],
      depth: 4,
    }),
    [questClaimStatus[QuestName.CreateArmy], entityArmies, hasTroops],
  );

  const travelQuest = useMemo(
    () => ({
      name: QuestName.Travel,
      description: "Travel with your army",
      status: hasTraveled
        ? questClaimStatus[QuestName.Travel]
          ? QuestStatus.Claimed
          : QuestStatus.Completed
        : QuestStatus.InProgress,
      steps: ["Go to world view", "Right click on your army", "Travel w/ your army"],
      prizes: questPrize.get(QuestName.Travel) || [],
      depth: 5,
    }),
    [questClaimStatus[QuestName.Travel], hasTraveled],
  );

  const buildWorkersHutQuest = useMemo(
    () => ({
      name: QuestName.BuildWorkersHut,
      description: "Build worker huts to extend your population capacity",
      status:
        buildingQuantities.workersHut > 0
          ? questClaimStatus[QuestName.BuildWorkersHut]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [],
      prizes: questPrize.get(QuestName.BuildWorkersHut) || [],
      depth: 6,
    }),
    [questClaimStatus[QuestName.BuildWorkersHut], buildingQuantities.workersHut],
  );

  const marketQuest = useMemo(
    () => ({
      name: QuestName.Market,
      description: "Build a market to produce donkeys. Donkeys are a resource used to transport goods",
      status:
        buildingQuantities.markets > 0
          ? questClaimStatus[QuestName.Market]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [],
      prizes: questPrize.get(QuestName.Market) || [],
      depth: 6,
    }),
    [questClaimStatus[QuestName.Market], buildingQuantities.markets],
  );

  const pillageQuest = useMemo(
    () => ({
      name: QuestName.Pillage,
      description: "Pillage a realm, hyperstructure or earthenshard mine",
      steps: [],
      prizes: questPrize.get(QuestName.Pillage) || [],
      depth: 6,
      status:
        pillageHistoryLength > 0
          ? questClaimStatus[QuestName.Pillage]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
    }),
    [questClaimStatus[QuestName.Pillage], pillageHistoryLength],
  );

  const mineQuest = useMemo(
    () => ({
      name: QuestName.Mine,
      description: "Explore the world, find earthenshard mines",
      status:
        fragmentMines > 0
          ? questClaimStatus[QuestName.Mine]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [],
      prizes: questPrize.get(QuestName.Mine) || [],
      depth: 6,
    }),
    [questClaimStatus[QuestName.Mine], fragmentMines],
  );

  const contributionQuest = useMemo(
    () => ({
      name: QuestName.Contribution,
      description: "Contribute to a Hyperstructure",
      status:
        hyperstructureContributions > 0
          ? questClaimStatus[QuestName.Contribution]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [],
      prizes: questPrize.get(QuestName.Contribution) || [],
      depth: 6,
    }),
    [questClaimStatus[QuestName.Contribution], hyperstructureContributions],
  );

  const hyperstructureQuest = useMemo(
    () => ({
      name: QuestName.Hyperstructure,
      description: "Build a Hyperstructure",
      status:
        hyperstructures > 0
          ? questClaimStatus[QuestName.Hyperstructure]
            ? QuestStatus.Claimed
            : QuestStatus.Completed
          : QuestStatus.InProgress,
      steps: [],
      prizes: questPrize.get(QuestName.Hyperstructure) || [],
      depth: 6,
    }),
    [questClaimStatus[QuestName.Hyperstructure], hyperstructures],
  );

  const quests: Quest[] = useMemo(
    () => [
      settleQuest,
      buildFarmQuest,
      buildResourceQuest,
      createTradeQuest,
      createArmyQuest,
      travelQuest,
      buildWorkersHutQuest,
      marketQuest,
      pillageQuest,
      mineQuest,
      contributionQuest,
      hyperstructureQuest,
    ],
    [
      settleQuest,
      buildFarmQuest,
      buildResourceQuest,
      createTradeQuest,
      createArmyQuest,
      travelQuest,
      buildWorkersHutQuest,
      marketQuest,
      pillageQuest,
      mineQuest,
      contributionQuest,
      hyperstructureQuest,
    ],
  );

  return { quests };
};

const useQuestDependencies = () => {
  const {
    setup: {
      components: { Contribution, EntityOwner },
    },
    account: { account },
  } = useDojo();

  const { playerRealms } = useEntities();
  const realm = playerRealms()[0];
  const realmEntityId = realm?.entity_id;

  const entityUpdate = useEntityQuery([HasValue(EntityOwner, { entity_owner_id: BigInt(realmEntityId || "0") })]);

  const buildingQuantities = useBuildingQuantities(realmEntityId);

  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: realmEntityId || BigInt("0") });
  const orders = useGetMyOffers();

  const hasTroops = useMemo(() => armyHasTroops(entityArmies), [entityArmies]);
  const hasTraveled = useMemo(() => armyHasTraveled(entityArmies, realm?.position), [entityArmies, realm?.position]);

  const [pillageHistoryLength, setPillageHistoryLength] = useState<number>(0);

  useEffect(() => {
    const fetchPillageHistory = async () => {
      const eventsLength = await getPillageEvents(BigInt(realmEntityId ?? "0"));
      setPillageHistoryLength(eventsLength);
    };
    fetchPillageHistory();
  }, [realmEntityId]);

  const { playerStructures } = useEntities();
  const structures = playerStructures();

  const countStructuresByCategory = useCallback(
    (category: string) => {
      return structures.filter((structure) => structure.category === category).length;
    },
    [structures],
  );

  const fragmentMines = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.FragmentMine]),
    [realmEntityId],
  );

  const hyperstructures = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.Hyperstructure]),
    [realmEntityId],
  );

  const hyperstructureContributions = useMemo(
    () => runQuery([HasValue(Contribution, { player_address: BigInt(account.address) })]).size,
    [realmEntityId],
  );

  return useMemo(
    () => ({
      buildingQuantities,
      entityArmies,
      orders,
      pillageHistoryLength,
      hasTroops,
      hasTraveled,
      fragmentMines,
      hyperstructures,
      hyperstructureContributions,
    }),
    [entityUpdate],
  );
};

export const useQuestClaimStatus = () => {
  const {
    setup: {
      components: { HasClaimedStartingResources, EntityOwner },
    },
  } = useDojo();

  const { playerRealms } = useEntities();
  const realm = playerRealms()[0];
  const realmEntityId = realm?.entity_id;

  const prizeUpdate = useEntityQuery([
    HasValue(HasClaimedStartingResources, { entity_id: BigInt(realmEntityId || "0") }),
  ]);

  const checkPrizesClaimed = (prizes: Prize[]) => {
    return prizes.every((prize) => {
      const value = getComponentValue(
        HasClaimedStartingResources,
        getEntityIdFromKeys([BigInt(realmEntityId || "0"), BigInt(prize.id)]),
      );
      return value?.claimed;
    });
  };

  const questClaimStatus = useMemo(() => {
    return Array.from(questPrize.keys()).reduce(
      (acc, questName) => ({
        ...acc,
        [questName]: checkPrizesClaimed(questPrize.get(questName) || []),
      }),
      {} as Record<QuestName, boolean>,
    );
  }, [prizeUpdate]);

  return { questClaimStatus };
};

export const useUnclaimedQuestsCount = () => {
  const { questClaimStatus } = useQuestClaimStatus();

  const unclaimedQuestsCount = useMemo(
    () => Object.values(questClaimStatus).filter((claimed) => !claimed).length,
    [questClaimStatus],
  );

  return { unclaimedQuestsCount };
};

const useBuildingQuantities = (realmEntityId: bigint | undefined) => {
  const {
    setup: {
      components: { BuildingQuantityv2, EntityOwner },
    },
  } = useDojo();
  const entityUpdate = useEntityQuery([HasValue(EntityOwner, { entity_owner_id: BigInt(realmEntityId || "0") })]);
  const getBuildingQuantity = (buildingType: BuildingType) =>
    getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(realmEntityId || "0"), BigInt(buildingType)]))
      ?.value || 0;

  return useMemo(
    () => ({
      farms: getBuildingQuantity(BuildingType.Farm),
      resource: getBuildingQuantity(BuildingType.Resource),
      workersHut: getBuildingQuantity(BuildingType.WorkersHut),
      markets: getBuildingQuantity(BuildingType.Market),
    }),
    [realmEntityId, entityUpdate],
  );
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

const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  if (entityArmies && entityArmies[0] && realmPosition) {
    return entityArmies[0].x != realmPosition.x || entityArmies[0].y != realmPosition.y;
  }
  return false;
};
