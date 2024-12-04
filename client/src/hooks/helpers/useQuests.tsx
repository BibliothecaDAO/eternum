import { TileManager } from "@/dojo/modelManager/TileManager";
import { QuestId, questDetails } from "@/ui/components/quest/questDetails";
import { BuildingType, ContractAddress, ID, QuestType, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback, useMemo } from "react";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { ArmyInfo, useArmiesByEntityOwner } from "./useArmies";
import { useEntities, useEntitiesUtils } from "./useEntities";
import { useGetMyOffers } from "./useTrade";

export interface Quest {
  id: QuestId;
  view: string;
  name: string;
  description: string | React.ReactNode;
  steps: (string | React.ReactNode)[];
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
  const questDependencies = useQuestDependencies();

  const createQuest = (questId: QuestId) => {
    const dependency = questDependencies[questId];
    return useMemo(
      () => ({
        id: questId,
        ...questDetails.get(questId)!,
        status: dependency.status,
      }),
      [questDependencies[questId]],
    );
  };

  const quests = [
    createQuest(QuestId.Settle),
    createQuest(QuestId.BuildFood),
    createQuest(QuestId.BuildResource),
    createQuest(QuestId.PauseProduction),
    createQuest(QuestId.CreateTrade),
    createQuest(QuestId.CreateDefenseArmy),
    createQuest(QuestId.CreateAttackArmy),
    createQuest(QuestId.Travel),
    createQuest(QuestId.BuildWorkersHut),
    createQuest(QuestId.Market),
    createQuest(QuestId.Pillage),
    createQuest(QuestId.Mine),
    createQuest(QuestId.Contribution),
    createQuest(QuestId.Hyperstructure),
  ];

  return { quests };
};

const useQuestDependencies = () => {
  const {
    setup,
    account: { account },
  } = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const entityUpdate = useEntityQuery([
    HasValue(setup.components.EntityOwner, { entity_owner_id: structureEntityId || 0 }),
  ]);
  const playerPillages = useEntityQuery([
    HasValue(setup.components.events.BattlePillageData, { pillager: BigInt(account.address) }),
  ]);
  const buildingQuantities = useBuildingQuantities(structureEntityId);
  const { entityArmies } = useArmiesByEntityOwner({ entity_owner_entity_id: structureEntityId || 0 });
  const orders = useGetMyOffers();
  const { playerStructures } = useEntities();
  const structures = playerStructures();
  const { getEntityInfo } = useEntitiesUtils();

  const structurePosition = useMemo(
    () => getEntityInfo(structureEntityId)?.position || { x: 0, y: 0 },
    [structureEntityId, getEntityInfo],
  );

  const tileManager = new TileManager(setup, {
    col: structurePosition.x,
    row: structurePosition.y,
  });

  const existingBuildings = useMemo(() => tileManager.existingBuildings(), [structurePosition]);
  const hasAnyPausedBuilding = useMemo(
    () => existingBuildings.some((building) => building.paused),
    [existingBuildings],
  );

  const hasDefensiveArmy = useMemo(
    () => entityArmies.some((army) => army.protectee?.protectee_id === structureEntityId && army.quantity.value > 0n),
    [entityArmies],
  );
  const hasAttackingArmy = useMemo(
    () => entityArmies.some((army) => army.protectee === undefined && army.quantity.value > 0n),
    [entityArmies],
  );

  const hasTraveled = useMemo(
    () => armyHasTraveled(entityArmies, structurePosition),
    [entityArmies, structurePosition],
  );

  const countStructuresByCategory = useCallback(
    (category: string) => {
      return structures.filter((structure) => structure.category === category).length;
    },
    [structures],
  );

  const fragmentMines = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.FragmentMine]),
    [structureEntityId, structures],
  );

  const hyperstructures = useMemo(
    () => countStructuresByCategory(StructureType[StructureType.Hyperstructure]),
    [structureEntityId, structures],
  );

  const hyperstructureContributions = useMemo(
    () =>
      runQuery([
        HasValue(setup.components.Contribution, { player_address: ContractAddress(account.address) }),
        NotValue(setup.components.Contribution, { resource_type: ResourcesIds["AncientFragment"] }),
      ]).size,
    [structureEntityId],
  );

  const { questClaimStatus } = useQuestClaimStatus();
  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();

  return useMemo(
    () => ({
      [QuestId.Settle]: {
        value: true,
        status: questClaimStatus[QuestId.Settle] ? QuestStatus.Claimed : QuestStatus.Completed,
      },
      [QuestId.BuildFood]: {
        value: questClaimStatus[QuestId.BuildFood] ? null : buildingQuantities.food,
        status: questClaimStatus[QuestId.BuildFood]
          ? QuestStatus.Claimed
          : buildingQuantities.food > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.BuildResource]: {
        value: questClaimStatus[QuestId.BuildResource] ? null : buildingQuantities.resource,
        status: questClaimStatus[QuestId.BuildResource]
          ? QuestStatus.Claimed
          : buildingQuantities.resource > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.PauseProduction]: {
        value: questClaimStatus[QuestId.PauseProduction] ? null : hasAnyPausedBuilding,
        status: questClaimStatus[QuestId.PauseProduction]
          ? QuestStatus.Claimed
          : hasAnyPausedBuilding
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateTrade]: {
        value: questClaimStatus[QuestId.CreateTrade] ? null : orders.length,
        status: questClaimStatus[QuestId.CreateTrade]
          ? QuestStatus.Claimed
          : orders.length > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateDefenseArmy]: {
        value: questClaimStatus[QuestId.CreateDefenseArmy] ? null : hasDefensiveArmy,
        status: questClaimStatus[QuestId.CreateDefenseArmy]
          ? QuestStatus.Claimed
          : hasDefensiveArmy
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.CreateAttackArmy]: {
        value: questClaimStatus[QuestId.CreateAttackArmy] ? null : hasAttackingArmy,
        status: questClaimStatus[QuestId.CreateAttackArmy]
          ? QuestStatus.Claimed
          : hasAttackingArmy
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Travel]: {
        value: questClaimStatus[QuestId.Travel] ? null : hasTraveled,
        status: questClaimStatus[QuestId.Travel]
          ? QuestStatus.Claimed
          : hasTraveled
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.BuildWorkersHut]: {
        value: questClaimStatus[QuestId.BuildWorkersHut] ? null : buildingQuantities.workersHut,
        status: questClaimStatus[QuestId.BuildWorkersHut]
          ? QuestStatus.Claimed
          : buildingQuantities.workersHut > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Market]: {
        value: questClaimStatus[QuestId.Market] ? null : buildingQuantities.markets,
        status: questClaimStatus[QuestId.Market]
          ? QuestStatus.Claimed
          : buildingQuantities.markets > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Pillage]: {
        value: questClaimStatus[QuestId.Pillage] ? null : playerPillages.length,
        status: questClaimStatus[QuestId.Pillage]
          ? QuestStatus.Claimed
          : playerPillages.length > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Mine]: {
        value: questClaimStatus[QuestId.Mine] ? null : fragmentMines,
        status: questClaimStatus[QuestId.Mine]
          ? QuestStatus.Claimed
          : fragmentMines > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Contribution]: {
        value: questClaimStatus[QuestId.Contribution] ? null : hyperstructureContributions,
        status: questClaimStatus[QuestId.Contribution]
          ? QuestStatus.Claimed
          : hyperstructureContributions > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
      [QuestId.Hyperstructure]: {
        value: questClaimStatus[QuestId.Hyperstructure] ? null : hyperstructures,
        status: questClaimStatus[QuestId.Hyperstructure]
          ? QuestStatus.Claimed
          : hyperstructures > 0
            ? QuestStatus.Completed
            : QuestStatus.InProgress,
      },
    }),
    [
      structureEntityId,
      questClaimStatus,
      unclaimedQuestsCount > 0 ? entityUpdate : null,
      unclaimedQuestsCount > 0 ? orders : null,
    ],
  );
};

export const useQuestClaimStatus = () => {
  const {
    setup: {
      components: { Quest, Realm },
    },
    account: { account },
  } = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const realmSettler = getComponentValue(Realm, getEntityIdFromKeys([BigInt(structureEntityId)]))?.settler_address;
  const isNotSettler = realmSettler !== ContractAddress(account.address);

  const prizeUpdate = useEntityQuery([HasValue(Quest, { entity_id: structureEntityId || 0 })]);

  const checkPrizesClaimed = (prizes: Prize[]) => {
    return prizes.every((prize) => {
      const value = getComponentValue(Quest, getEntityIdFromKeys([BigInt(structureEntityId || 0), BigInt(prize.id)]));
      return value?.completed;
    });
  };

  const questClaimStatus = useMemo(() => {
    return Array.from(questDetails.keys()).reduce(
      (acc, questName) => ({
        ...acc,
        [questName]: isNotSettler || checkPrizesClaimed(questDetails.get(questName)?.prizes || []),
      }),
      {} as Record<QuestId, boolean>,
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

const useBuildingQuantities = (structureEntityId: ID | undefined) => {
  const {
    setup: {
      components: { BuildingQuantityv2 },
    },
  } = useDojo();
  const entityUpdate = useEntityQuery([HasValue(BuildingQuantityv2, { entity_id: structureEntityId || 0 })]);
  const getBuildingQuantity = (buildingType: BuildingType) =>
    getComponentValue(BuildingQuantityv2, getEntityIdFromKeys([BigInt(structureEntityId || 0), BigInt(buildingType)]))
      ?.value || 0;

  return useMemo(
    () => ({
      food: getBuildingQuantity(BuildingType.Farm) + getBuildingQuantity(BuildingType.FishingVillage),
      resource: getBuildingQuantity(BuildingType.Resource),
      workersHut: getBuildingQuantity(BuildingType.WorkersHut),
      markets: getBuildingQuantity(BuildingType.Market),
    }),
    [structureEntityId, entityUpdate],
  );
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return entityArmies.some(
    (army) =>
      army &&
      (Number(army.troops.knight_count) !== 0 ||
        Number(army.troops.crossbowman_count) !== 0 ||
        Number(army.troops.paladin_count) !== 0),
  );
};

const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  return entityArmies.some(
    (army) => army && realmPosition && (army.position.x !== realmPosition.x || army.position.y !== realmPosition.y),
  );
};
