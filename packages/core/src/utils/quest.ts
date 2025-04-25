import { ClientComponents, ContractAddress, ID, QuestTile } from "@bibliothecadao/types";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export const getQuest = (questEntityId: ID | Entity, components: ClientComponents) => {
  const entityId = typeof questEntityId === "string" ? questEntityId : getEntityIdFromKeys([BigInt(questEntityId)]);
  return formatQuests([entityId], components)[0];
};

export const formatQuests = (quests: Entity[], components: ClientComponents): QuestTile[] => {
  return quests
    .map((questEntity) => {
      const quest = getComponentValue(components.QuestTile, questEntity);
      if (!quest) return undefined;

      // const position = explorerTroops.coord;

      // const actualExplorerTroopsCount = divideByPrecision(Number(explorerTroops.troops.count));
      // const totalCapacityKg = Number(getArmyTotalCapacityInKg(actualExplorerTroopsCount));

      // const resource = getComponentValue(components.Resource, armyEntity);
      // const weightKg = resource ? gramToKg(divideByPrecision(Number(resource.weight.weight))) : 0;

      // const stamina = explorerTroops.troops.stamina.amount;
      // const name = getComponentValue(components.AddressName, armyEntity);
      // const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(explorerTroops.owner)]));

      // const isMine = (structure?.owner || 0n) === playerAddress;

      // const isMercenary = structure?.owner === 0n;

      // const isHome = structure && isArmyAdjacentToStructure(position, structure.base.coord_x, structure.base.coord_y);

      return {
        id: quest.id,
        game_address: ContractAddress(quest.game_address),
        coord: {
          x: quest.coord.x,
          y: quest.coord.y,
        },
        level: quest.level,
        resource_type: quest.resource_type,
        amount: quest.amount,
        capacity: quest.capacity,
        participant_count: quest.participant_count,
      };
    })
    .filter((quest): quest is QuestTile => quest !== undefined);
};
