import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useArmiesByEntityOwner } from "@/hooks/helpers/useArmies";
import { useGetMyOffers } from "@/hooks/helpers/useTrade";
import { BuildingType, QuestType, StructureType } from "@bibliothecadao/eternum";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getPillageEvents } from "@/dojo/events/pillageEventQueries";
import { View as LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import { useLocation } from "wouter";
import { create } from "zustand";
import { useEntities } from "../helpers/useEntities";
import useUIStore from "./useUIStore";

export enum QuestName {
  Settle = "Settle",
  BuildFarm = "Build a Farm",
  BuildResource = "Build a Resource Facility",
  CreateTrade = "Create a Trade",
  CreateArmy = "Create an Army",
  Travel = "Travel with your Army",
  BuildWorkersHut = "Build a workers hut.",
  Market = "Build a market.",
  Pillage = "Pillage a structure.",
  Mine = "Discover an earthenshard mine.",
  Contribution = "Contribute to a hyperstructure.",
  Hyperstructure = "Build a hyperstructure.",
}

export interface Quest {
  name: string;
  description: string;
  steps: Step[];
  completed?: boolean;
  claimed?: boolean;
  prizes: Prize[];
  depth: number;
}

interface Step {
  description: string;
  completed: boolean;
}

export interface Prize {
  id: number;
  title: string;
}

export interface QuestStore {
  quests: Quest[] | undefined;
  setQuests: (quests: Quest[] | undefined) => void;
  selectedQuest: Quest | undefined;
  setSelectedQuest: (selectedQuest: Quest | undefined) => void;
  claimableQuestsLength: number;
  setClaimableQuestsLength: (claimableQuestsLength: number) => void;
  showCompletedQuests: boolean;
  setShowCompletedQuests: (showCompletedQuests: boolean) => void;
}

export const useQuestStore = create<QuestStore>((set) => {
  return {
    quests: undefined,
    setQuests: (quests: Quest[] | undefined) => set({ quests }),
    selectedQuest: undefined,
    setSelectedQuest: (selectedQuest: Quest | undefined) => set({ selectedQuest }),
    claimableQuestsLength: 0,
    setClaimableQuestsLength: (claimableQuestsLength: number) => set({ claimableQuestsLength }),
    showCompletedQuests: false,
    setShowCompletedQuests: (showCompletedQuests: boolean) => set({ showCompletedQuests }),
  };
});

export const useQuests = () => {
  const {
    setup: {
      components: { BuildingQuantityv2, HasClaimedStartingResources, Contribution },
    },
    account: { account },
  } = useDojo();

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const leftView = useUIStore((state) => state.leftNavigationView);
  const previewBuilding = useUIStore((state) => state.previewBuilding);

  const setQuests = useQuestStore((state) => state.setQuests);
  const selectedQuest = useQuestStore((state) => state.selectedQuest);
  const setSelectedQuest = useQuestStore((state) => state.setSelectedQuest);
  const setClaimableQuestsLength = useQuestStore((state) => state.setClaimableQuestsLength);

  const { playerRealms } = useEntities();
  const realm = playerRealms()[0];
  const entityId = realm?.entity_id;
  const realmPosition = realm?.position;

  const [location, _] = useLocation();
  const isWorldView = useMemo(() => location === "/map", [location]);

  const getBuildingQuantity = (buildingType: BuildingType) =>
    getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(entityId || "0"), BigInt(buildingType)]))
      ?.value || 0;

  const farms = getBuildingQuantity(BuildingType.Farm);
  const resource = getBuildingQuantity(BuildingType.Resource);
  const workersHut = getBuildingQuantity(BuildingType.WorkersHut);
  const markets = getBuildingQuantity(BuildingType.Market);

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
    [countStructuresByCategory],
  );
  const hyperstructures = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.Hyperstructure]),
    [countStructuresByCategory],
  );

  const hyperstructureContributions = runQuery([
    HasValue(Contribution, { player_address: BigInt(account.address) }),
  ]).size;

  const orders = useGetMyOffers();

  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: entityId || BigInt("0") });

  const [pillageHistoryLength, setPillageHistoryLength] = useState<number>(0);

  const hasTroops = useMemo(() => armyHasTroops(entityArmies), [entityArmies]);
  const hasTraveled = useMemo(() => armyHasTraveled(entityArmies, realmPosition), [entityArmies, realmPosition]);

  useEffect(() => {
    const fetchPillageHistory = async () => {
      const eventsLength = await getPillageEvents(BigInt(entityId ?? "0"));
      setPillageHistoryLength(eventsLength);
    };
    fetchPillageHistory();
  }, [entityId]);

  const quests: Quest[] = useMemo(() => {
    const updatedQuests = [
      {
        name: QuestName.Settle,
        description: "A gift of food from the gods.",
        completed: true,
        steps: [{ description: "Settle your first Realm.", completed: true }],
        prizes: [{ id: QuestType.Food, title: "Common Resources" }],
        depth: 0,
      },
      {
        name: QuestName.BuildFarm,
        description: "Wheat is the lifeblood of your people. Go to the construction menu and build a farm.",
        completed: farms > 0,
        steps: [
          { description: "Navigate to the construction menu.", completed: leftView === LeftView.ConstructionView },
          {
            description: "Select the 'Farm' card",
            completed: previewBuilding !== null,
          },
          {
            description: "Left click on a hex to build it, or right click to cancel.",
            completed: farms > 0,
          },
        ],
        prizes: [
          { id: QuestType.CommonResources, title: "Common Resources" },
          { id: QuestType.UncommonResources, title: "Uncommon Resources" },
          { id: QuestType.RareResources, title: "Rare Resources" },
          { id: QuestType.UniqueResources, title: "Unique Resources" },
          { id: QuestType.LegendaryResources, title: "Legendary Resources" },
          { id: QuestType.MythicResources, title: "Mythic Resources" },
        ],
        depth: 1,
      },
      {
        name: QuestName.BuildResource,
        description: "Eternum thrives on resources. Construct resource facilities to harvest them efficiently.",
        completed: resource > 0,
        steps: [
          { description: "Navigate to the construction menu.", completed: leftView === LeftView.ConstructionView },
          {
            description: "Navigate to the 'Resources' tab and select a resource card",
            completed: previewBuilding !== null,
          },
          {
            description: "Left click on a hex to build it, or right click to cancel.",
            completed: resource > 0,
          },
        ],
        prizes: [{ id: QuestType.Trade, title: "Donkeys and Lords" }],
        depth: 2,
      },
      {
        name: QuestName.CreateTrade,
        description: "Trading is the lifeblood of Eternum. Create a trade to start your economy.",
        completed: orders.length > 0,
        steps: [],
        prizes: [{ id: QuestType.Military, title: "Claim Starting Army" }],
        depth: 3,
      },
      {
        name: QuestName.CreateArmy,
        description: "Conquest is fulfilling. Create an army to conquer your enemies.",
        completed: entityArmies.length > 0 && hasTroops,
        steps: [
          { description: "Create an army to conquer your enemies.", completed: entityArmies.length > 0 },
          {
            description: "Assign troops to your army",
            completed: hasTroops,
          },
        ],
        prizes: [{ id: QuestType.Earthenshard, title: "Claim Earthen Shard" }],
        depth: 3,
      },
      {
        name: QuestName.Travel,
        description: "Travel with your army.",
        completed: armyHasTraveled(entityArmies, realmPosition),
        steps: [
          { description: "Go to world view.", completed: isWorldView },
          {
            description: "Right click on your army",
            completed: selectedEntity != null || hasTraveled,
          },
          { description: "Travel w/ your army.", completed: hasTraveled },
        ],
        prizes: [{ id: QuestType.Travel, title: "Travel" }],
        depth: 4,
      },
      {
        name: QuestName.BuildWorkersHut,
        description: "Build worker huts to extend your population capacity.",
        completed: workersHut > 0,
        steps: [],
        prizes: [{ id: QuestType.Population, title: "Population" }],
        depth: 5,
      },
      {
        name: QuestName.Market,
        description: "Build a market to produce donkeys. Donkeys are a resource used to transport goods.",
        completed: markets > 0,
        steps: [],
        prizes: [{ id: QuestType.Market, title: "Market" }],
        depth: 5,
      },
      {
        name: QuestName.Pillage,
        description: "Pillage a realm, hyperstructure or earthenshard mine.",
        completed: pillageHistoryLength > 0,
        steps: [],
        prizes: [{ id: QuestType.Pillage, title: "Pillage" }],
        depth: 5,
      },
      {
        name: QuestName.Mine,
        description: "Explore the world, find earthenshard mines.",
        completed: fragmentMines > 0,
        steps: [],
        prizes: [{ id: QuestType.Mine, title: "Mine" }],
        depth: 5,
      },
      {
        name: QuestName.Contribution,
        description: "Contribute to a Hyperstructure.",
        completed: hyperstructureContributions > 0,
        steps: [],
        prizes: [{ id: QuestType.Contribution, title: "Contribution" }],
        depth: 5,
      },
      {
        name: QuestName.Hyperstructure,
        description: "Build a Hyperstructure.",
        completed: hyperstructures > 0,
        steps: [],
        prizes: [{ id: QuestType.Hyperstructure, title: "Hyperstructure" }],
        depth: 5,
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
  }, [
    farms,
    resource,
    orders,
    entityArmies,
    hasTroops,
    hasTraveled,
    workersHut,
    markets,
    fragmentMines,
    hyperstructures,
    hyperstructureContributions,
    pillageHistoryLength,
    selectedEntity,
    isWorldView,
    leftView,
    previewBuilding,
  ]);

  useEffect(() => {
    setQuests(quests);

    const claimableQuestsLenght = quests.filter((quest) => !quest.claimed).length;
    setClaimableQuestsLength(claimableQuestsLenght);
  }, []);

  useEffect(() => {
    setQuests(quests);
    setSelectedQuest(quests.find((quest) => quest.name === selectedQuest?.name));

    const claimableQuestsLenght = quests.filter((quest) => !quest.claimed).length;
    setClaimableQuestsLength(claimableQuestsLenght);
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

const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  if (entityArmies && entityArmies[0] && realmPosition) {
    return entityArmies[0].position.x != realmPosition.x || entityArmies[0].position.y != realmPosition.y;
  }
  return false;
};
