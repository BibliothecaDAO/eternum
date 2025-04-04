import { getBlockTimestamp } from "@/utils/timestamp";
import { ClientComponents } from "@bibliothecadao/eternum";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";

export const getQuestLocation = (components: ClientComponents, coord: { x: number; y: number }) => {
  console.log(components);
  const questEntities1 = runQuery([HasValue(components.QuestDetails, { id: 2 })]);
  const questEntities2 = runQuery([HasValue(components.QuestDetails, { expires_at: 0n })]);
  console.log(questEntities1, 1);
  console.log(questEntities2, { expires_at: 0n });
  const entitiesArray = Array.from(questEntities1);
  const questEntities1Values = getComponentValue(components.QuestDetails, entitiesArray[0]);
  console.log(questEntities1Values);
  return questEntities2;
};

/**
 * Gets all quest locations from the game state
 */
export const getQuestLocations = (components: ClientComponents) => {
  // Get current timestamp for expiration check
  const currentTimestamp = getBlockTimestamp();
  console.log("Current timestamp:", currentTimestamp);

  // Query for all QuestDetails
  const questEntities = runQuery([HasValue(components.QuestDetails, { expires_at: 0n })]);
  console.log(components.QuestDetails.values);
  console.log("Quest entities found:", Array.from(questEntities).length);

  // Process and filter quests
  const questPositions = Array.from(questEntities)
    .map((entity) => {
      const questDetails = getComponentValue(components.QuestDetails, entity);
      console.log(`Quest entity ${entity} details:`, questDetails);

      if (questDetails) {
        // Check if quest is valid (not expired or has no expiration)
        const isValid =
          questDetails.expires_at === 0n || questDetails.expires_at > currentTimestamp.currentBlockTimestamp;

        if (isValid) {
          return {
            entityId: entity,
            position: {
              x: questDetails.coord.x,
              y: questDetails.coord.y,
            },
            reward: questDetails.reward,
            capacity: questDetails.capacity,
            participantCount: questDetails.participant_count,
            targetScore: questDetails.target_score,
            expiresAt: questDetails.expires_at,
            gameAddress: questDetails.game_address,
          };
        }
        console.log(`Quest ${entity} is expired or invalid`);
      }
      return null;
    })
    .filter(Boolean);

  console.log("Valid quest positions:", questPositions);
  return questPositions;
};

/**
 * Gets quest details for a specific quest
 */
export const getQuestDetails = (components: ClientComponents, questId: number) => {
  const questEntity = getComponentValue(components.Quest, questId);
  if (!questEntity) return null;

  const questDetails = getComponentValue(components.QuestDetails, questEntity.details_id);
  if (!questDetails) return null;

  return {
    id: questEntity.id,
    detailsId: questEntity.details_id,
    explorerId: questEntity.explorer_id,
    gameTokenId: questEntity.game_token_id,
    completed: questEntity.completed,
    position: {
      x: questDetails.coord.x,
      y: questDetails.coord.y,
    },
    reward: questDetails.reward,
    capacity: questDetails.capacity,
    participantCount: questDetails.participant_count,
    targetScore: questDetails.target_score,
    expiresAt: questDetails.expires_at,
    gameAddress: questDetails.game_address,
  };
};
