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
