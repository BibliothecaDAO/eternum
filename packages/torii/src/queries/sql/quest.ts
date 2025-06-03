export const QUEST_QUERIES = {
  QUEST_BY_ENTITY_ID: `
    SELECT 
        id,
        game_address,
        \`coord.x\` AS coord_x,
        \`coord.y\` AS coord_y,
        level,
        resource_type,
        amount,
        capacity,
        participant_count
    FROM \`s1_eternum-QuestTile\`
    WHERE id = {entityId};
  `,
} as const;
