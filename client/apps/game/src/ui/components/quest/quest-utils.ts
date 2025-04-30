import { ClientComponents } from "@bibliothecadao/types";
import { Query, ToriiClient } from "@dojoengine/torii-wasm";

export const formatQuests = (quests: any[]) => {
  return quests.map((quest) => {
    return {
      ...quest,
    };
  });
};

export const getQuests = async (
  toriiClient: ToriiClient,
  components: ClientComponents,
  gameAddress: string,
  questGames: any,
) => {
  const queryQuests = {
    clause: {
      Composite: {
        operator: "And",
        clauses: [
          {
            Member: {
              model: "s1_eternum-Quest",
              member: "game_address",
              operator: "Eq",
              value: {
                String: gameAddress,
              },
            },
          },
          {
            Member: {
              model: "s1_eternum-Quest",
              member: "game_token_id",
              operator: "In",
              value: {
                List: questGames.map((game: any) => {
                  return {
                    Primitive: {
                      U64: Number(game.token_id),
                    },
                  };
                }),
              },
            },
          },
        ],
      },
    },
    limit: 100,
    offset: 0,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Quest"],
    entity_updated_after: 0,
  } as Query;

  // return getEntities(
  //   toriiClient,
  //   queryQuests.clause,
  //   components as any,
  //   [],
  //   ["s1_eternum-Quest"],
  //   EVENT_QUERY_LIMIT,
  //   true,
  // );

  const result = await toriiClient.getEntities(queryQuests, false);

  const resultArray = Array.isArray(result) ? result : result ? [result] : [];

  // Processed quests array
  const processedQuests = [];

  // Process the nested structure
  for (const entity of resultArray) {
    for (const entityId in entity) {
      // Skip non-entity ID properties
      if (!entityId.startsWith("0x")) continue;

      const questData = entity[entityId];
      if (!questData || !questData["s1_eternum-Quest"]) continue;

      const quest = questData["s1_eternum-Quest"];

      processedQuests.push({
        entityId,
        completed: quest.completed?.value === true,
        explorer_id: Number(quest.explorer_id?.value),
        game_address: quest.game_address?.value,
        game_token_id: quest.game_token_id?.value, // Keep hex string or convert as needed
        quest_tile_id: Number(quest.quest_tile_id?.value),
        // Add any other fields you need
      });
    }
  }

  return processedQuests;
};

/**
 * Gets all quest locations from the game state
 */
export const getQuestForExplorer = async (
  toriiClient: ToriiClient,
  components: ClientComponents,
  explorerId: number,
) => {
  const queryQuests = {
    clause: {
      Member: {
        model: "s1_eternum-Quest",
        member: "explorer_id",
        operator: "Eq",
        value: { Primitive: { U32: explorerId } },
      },
    },
    limit: 1,
    offset: 0,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Quest"],
    entity_updated_after: 0,
  } as Query;

  // return getEntities(toriiClient, queryQuests.clause, components as any, [], ["s1_eternum-Quest"], EVENT_QUERY_LIMIT);

  console.log(queryQuests);

  const result = await toriiClient.getEntities(queryQuests, false);

  for (const entityId in result) {
    // Skip non-entity ID properties
    if (!entityId.startsWith("0x")) continue;

    const questData = result[entityId];
    if (!questData || !questData["s1_eternum-Quest"]) continue;

    const quest = questData["s1_eternum-Quest"];

    return {
      entityId,
      completed: quest.completed?.value === true,
      explorer_id: Number(quest.explorer_id?.value),
      game_address: quest.game_address?.value,
      game_token_id: quest.game_token_id?.value, // Keep hex string or convert as needed
      quest_tile_id: Number(quest.quest_tile_id?.value),
      // Add any other fields you need
    };
  }
};
