export const buildLeaderboardQuery = (limit?: number): string => {
  const hasLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0;
  const limitClause = hasLimit ? `LIMIT ${limit}\n        OFFSET 0` : "";

  return `
    WITH RECURSIVE
      registered_raw AS (
        SELECT
          lower(COALESCE(
            NULLIF("address", 'address'),
            NULLIF("player_registered_points.address", 'player_registered_points.address'),
            ''
          )) AS player_address,
          COALESCE(
            NULLIF("registered_points", 'registered_points'),
            NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
            '0x0'
          ) AS raw_points,
          COALESCE(
            NULLIF("prize_claimed", 'prize_claimed'),
            NULLIF("player_registered_points.prize_claimed", 'player_registered_points.prize_claimed'),
            0
          ) AS prize_claimed
        FROM "s1_eternum-PlayerRegisteredPoints"
      ),
      registered_normalized AS (
        SELECT
          player_address,
          prize_claimed,
          CASE
            WHEN lower(raw_points) LIKE '0x%'
              THEN substr(lower(raw_points), 3)
            ELSE lower(raw_points)
          END AS hex_points
        FROM registered_raw
      ),
      registered_sorted AS (
        SELECT
          player_address,
          prize_claimed,
          hex_points,
          CASE
            WHEN ltrim(hex_points, '0') = '' THEN '0'
            ELSE ltrim(hex_points, '0')
          END AS sort_hex
        FROM registered_normalized
      ),
      ranked_players AS (
        SELECT
          player_address,
          prize_claimed,
          hex_points,
          sort_hex
        FROM registered_sorted
        ORDER BY length(sort_hex) DESC, sort_hex DESC, player_address
        ${limitClause}
      ),
      points_story AS (
        SELECT
          lower(COALESCE("story.PointsRegisteredStory.owner_address", '')) AS player_address,
          lower(
            replace(
              replace(
                replace(trim(COALESCE("story.PointsRegisteredStory.activity", '')), 'pointsactivity::', ''),
                'pointsactivity.', ''
              ),
              'pointsactivity', ''
            )
          ) AS raw_activity,
          lower(trim(COALESCE("story.PointsRegisteredStory.points", '0'))) AS raw_points
        FROM "s1_eternum-StoryEvent"
        WHERE story = 'PointsRegisteredStory'
          AND "story.PointsRegisteredStory.owner_address" IS NOT NULL
          AND lower(COALESCE("story.PointsRegisteredStory.owner_address", '')) IN (
            SELECT player_address FROM ranked_players
          )
      ),
      points_story_normalized AS (
        SELECT
          player_address,
          raw_activity,
          raw_points,
          CASE
            WHEN raw_activity = '0' THEN 'exploration'
            WHEN raw_activity = '1' THEN 'openrelicchest'
            WHEN raw_activity = '2' THEN 'hyperstructuresharepoints'
            WHEN raw_activity = '3' THEN 'hyperstructurebanditsdefeat'
            WHEN raw_activity = '4' THEN 'otherstructurebanditsdefeat'
            ELSE raw_activity
          END AS activity
        FROM points_story
      ),
      points_story_prepared AS (
        SELECT
          player_address,
          activity,
          COALESCE(
            CASE
              WHEN raw_points LIKE '0x%'
                THEN substr(raw_points, 3)
              ELSE raw_points
            END,
            '0'
          ) AS normalized_points,
          CASE
            WHEN raw_points LIKE '0x%'
              THEN 1
            ELSE 0
          END AS is_hex
        FROM points_story_normalized
        WHERE player_address <> ''
          AND activity <> ''
          AND activity IS NOT NULL
          AND activity <> 'hyperstructuresharepoints'
      ),
      points_story_hex AS (
        SELECT
          player_address,
          activity,
          normalized_points AS hex_points,
          length(normalized_points) AS hex_length,
          0 AS idx,
          0 AS points
        FROM points_story_prepared
        WHERE is_hex = 1
        UNION ALL
        SELECT
          h.player_address,
          h.activity,
          h.hex_points,
          h.hex_length,
          h.idx + 1,
          h.points * 16 + CASE
            WHEN instr('0123456789abcdef', substr(h.hex_points, h.idx + 1, 1)) = 0 THEN 0
            ELSE instr('0123456789abcdef', substr(h.hex_points, h.idx + 1, 1)) - 1
          END
        FROM points_story_hex AS h
        WHERE h.idx < h.hex_length
      ),
      points_story_hex_totals AS (
        SELECT
          player_address,
          activity,
          points
        FROM points_story_hex
        WHERE idx = hex_length
      ),
      points_story_decimal AS (
        SELECT
          player_address,
          activity,
          CASE
            WHEN trim(normalized_points) = '' THEN 0
            ELSE CAST(normalized_points AS INTEGER)
          END AS points
        FROM points_story_prepared
        WHERE is_hex = 0
      ),
      points_story_combined AS (
        SELECT
          player_address,
          activity,
          points
        FROM points_story_decimal
        UNION ALL
        SELECT
          player_address,
          activity,
          points
        FROM points_story_hex_totals
      ),
      points_activity_totals AS (
        SELECT
          player_address,
          activity,
          COUNT(*) AS activity_count,
          SUM(points) AS activity_points
        FROM points_story_combined
        GROUP BY player_address, activity
      ),
      points_activity_pivot AS (
        SELECT
          player_address,
          MAX(CASE WHEN activity = 'exploration' THEN activity_points ELSE 0 END) AS exploration_points,
          MAX(CASE WHEN activity = 'exploration' THEN activity_count ELSE 0 END) AS exploration_count,
          MAX(CASE WHEN activity = 'openrelicchest' THEN activity_points ELSE 0 END) AS open_relic_chest_points,
          MAX(CASE WHEN activity = 'openrelicchest' THEN activity_count ELSE 0 END) AS open_relic_chest_count,
          MAX(CASE WHEN activity = 'hyperstructurebanditsdefeat' THEN activity_points ELSE 0 END) AS hyperstructure_bandits_defeat_points,
          MAX(CASE WHEN activity = 'hyperstructurebanditsdefeat' THEN activity_count ELSE 0 END) AS hyperstructure_bandits_defeat_count,
          MAX(CASE WHEN activity = 'otherstructurebanditsdefeat' THEN activity_points ELSE 0 END) AS other_structure_bandits_defeat_points,
          MAX(CASE WHEN activity = 'otherstructurebanditsdefeat' THEN activity_count ELSE 0 END) AS other_structure_bandits_defeat_count
        FROM points_activity_totals
        GROUP BY player_address
      )
    SELECT
      ranked_players.player_address,
      '0x' || ranked_players.hex_points AS registered_points,
      ranked_players.prize_claimed,
      COALESCE(
        NULLIF("name", 'name'),
        NULLIF("address_name.name", 'address_name.name'),
        ''
      ) AS player_name,
      COALESCE(points_activity_pivot.exploration_points, 0) AS exploration_points,
      COALESCE(points_activity_pivot.exploration_count, 0) AS exploration_count,
      COALESCE(points_activity_pivot.open_relic_chest_points, 0) AS open_relic_chest_points,
      COALESCE(points_activity_pivot.open_relic_chest_count, 0) AS open_relic_chest_count,
      COALESCE(points_activity_pivot.hyperstructure_bandits_defeat_points, 0) AS hyperstructure_bandits_defeat_points,
      COALESCE(points_activity_pivot.hyperstructure_bandits_defeat_count, 0) AS hyperstructure_bandits_defeat_count,
      COALESCE(points_activity_pivot.other_structure_bandits_defeat_points, 0) AS other_structure_bandits_defeat_points,
      COALESCE(points_activity_pivot.other_structure_bandits_defeat_count, 0) AS other_structure_bandits_defeat_count
    FROM ranked_players
    LEFT JOIN "s1_eternum-AddressName"
      ON lower(COALESCE(
        NULLIF("address", 'address'),
        NULLIF("address_name.address", 'address_name.address'),
        ''
      )) = ranked_players.player_address
    LEFT JOIN points_activity_pivot
      ON points_activity_pivot.player_address = ranked_players.player_address
    ORDER BY length(ranked_players.sort_hex) DESC, ranked_players.sort_hex DESC, ranked_players.player_address;
`;
};

export const STORY_EVENT_SELECT_FIELDS = `
      "owner.Some" as owner,
      "entity_id.Some" as entity_id,
      tx_hash,
      story,
      timestamp,
      internal_event_id as event_id,
      "story.RealmCreatedStory.coord.x" as realm_coord_x,
      "story.RealmCreatedStory.coord.y" as realm_coord_y,
      "story.ExplorerMoveStory.explorer_id" as explorer_id,
      "story.ExplorerMoveStory.explorer_structure_id" as explorer_structure_id,
      "story.ExplorerMoveStory.start_coord.x" as start_coord_x,
      "story.ExplorerMoveStory.start_coord.y" as start_coord_y,
      "story.ExplorerMoveStory.end_coord.x" as end_coord_x,
      "story.ExplorerMoveStory.end_coord.y" as end_coord_y,
      "story.ExplorerMoveStory.directions" as explorer_directions,
      "story.ExplorerMoveStory.explore" as explorer_explore,
      "story.ExplorerMoveStory.explore_find" as explore_find,
      "story.ExplorerExtractRewardStory.explorer_id" as extract_explorer_id,
      "story.ExplorerExtractRewardStory.explorer_structure_id" as extract_explorer_structure_id,
      "story.ExplorerExtractRewardStory.coord.x" as extract_coord_x,
      "story.ExplorerExtractRewardStory.coord.y" as extract_coord_y,
      "story.ExplorerExtractRewardStory.reward_resource_type" as extract_reward_resource_type,
      "story.ExplorerExtractRewardStory.reward_resource_amount" as extract_reward_resource_amount,
      "story.StructureLevelUpStory.new_level" as structure_new_level,
      "story.BattleStory.attacker_id" as battle_attacker_id,
      "story.BattleStory.defender_id" as battle_defender_id,
      "story.BattleStory.winner_id" as battle_winner_id,
      "story.BattleStory.battle_type" as battle_type,
      "story.BattleStory.attacker_owner_address" as battle_attacker_owner_address,
      "story.BattleStory.defender_owner_address" as battle_defender_owner_address,
      "story.BattleStory.attacker_owner_id" as battle_attacker_owner_id,
      "story.BattleStory.defender_owner_id" as battle_defender_owner_id,
      "story.BattleStory.attacker_troops_type" as battle_attacker_troops_type,
      "story.BattleStory.attacker_troops_tier" as battle_attacker_troops_tier,
      "story.BattleStory.attacker_troops_before" as battle_attacker_troops_before,
      "story.BattleStory.attacker_troops_lost" as battle_attacker_troops_lost,
      "story.BattleStory.defender_troops_type" as battle_defender_troops_type,
      "story.BattleStory.defender_troops_tier" as battle_defender_troops_tier,
      "story.BattleStory.defender_troops_before" as battle_defender_troops_before,
      "story.BattleStory.defender_troops_lost" as battle_defender_troops_lost,
      "story.BattleStory.stolen_resources" as battle_stolen_resources,
      "story.ProductionStory.received_resource_type" as production_resource_type,
      "story.ProductionStory.received_amount" as production_amount,
      "story.ProductionStory.cost" as production_cost,
      "story.BuildingPlacementStory.category" as building_category,
      "story.BuildingPlacementStory.inner_coord.x" as building_coord_x,
      "story.BuildingPlacementStory.inner_coord.y" as building_coord_y,
      "story.BuildingPlacementStory.created" as building_created,
      "story.BuildingPlacementStory.destroyed" as building_destroyed,
      "story.BuildingPlacementStory.paused" as building_paused,
      "story.BuildingPlacementStory.unpaused" as building_unpaused,
      "story.BuildingPaymentStory.category" as building_payment_category,
      "story.BuildingPaymentStory.inner_coord.x" as building_payment_coord_x,
      "story.BuildingPaymentStory.inner_coord.y" as building_payment_coord_y,
      "story.BuildingPaymentStory.cost" as building_payment_cost,
      "story.ResourceTransferStory.transfer_type" as resource_transfer_type,
      "story.ResourceTransferStory.from_entity_id" as resource_transfer_from_entity_id,
      "story.ResourceTransferStory.from_entity_owner_address" as resource_transfer_from_owner_address,
      "story.ResourceTransferStory.to_entity_id" as resource_transfer_to_entity_id,
      "story.ResourceTransferStory.to_entity_owner_address" as resource_transfer_to_owner_address,
      "story.ResourceTransferStory.resources" as resource_transfer_resources,
      "story.ResourceTransferStory.is_mint" as resource_transfer_is_mint,
      "story.ResourceTransferStory.travel_time" as resource_transfer_travel_time,
      "story.ResourceBurnStory.resources" as resource_burn_resources,
      "story.ResourceReceiveArrivalStory.resources" as resource_receive_resources,
      "story.GuardAddStory.structure_id" as guard_add_structure_id,
      "story.GuardAddStory.slot" as guard_add_slot,
      "story.GuardAddStory.category" as guard_add_category,
      "story.GuardAddStory.tier" as guard_add_tier,
      "story.GuardAddStory.amount" as guard_add_amount,
      "story.GuardDeleteStory.structure_id" as guard_delete_structure_id,
      "story.GuardDeleteStory.slot" as guard_delete_slot,
      "story.ExplorerCreateStory.structure_id" as explorer_create_structure_id,
      "story.ExplorerCreateStory.explorer_id" as explorer_create_explorer_id,
      "story.ExplorerCreateStory.category" as explorer_create_category,
      "story.ExplorerCreateStory.tier" as explorer_create_tier,
      "story.ExplorerCreateStory.amount" as explorer_create_amount,
      "story.ExplorerCreateStory.spawn_direction" as explorer_create_spawn_direction,
      "story.ExplorerAddStory.explorer_id" as explorer_add_explorer_id,
      "story.ExplorerAddStory.amount" as explorer_add_amount,
      "story.ExplorerAddStory.home_direction" as explorer_add_home_direction,
      "story.ExplorerDeleteStory.explorer_id" as explorer_delete_explorer_id,
      "story.ExplorerExplorerSwapStory.from_explorer_id" as explorer_swap_from_id,
      "story.ExplorerExplorerSwapStory.to_explorer_id" as explorer_swap_to_id,
      "story.ExplorerExplorerSwapStory.to_explorer_direction" as explorer_swap_to_direction,
      "story.ExplorerExplorerSwapStory.count" as explorer_swap_count,
      "story.ExplorerGuardSwapStory.from_explorer_id" as explorer_guard_swap_from_explorer_id,
      "story.ExplorerGuardSwapStory.to_structure_id" as explorer_guard_swap_to_structure_id,
      "story.ExplorerGuardSwapStory.to_structure_direction" as explorer_guard_swap_to_structure_direction,
      "story.ExplorerGuardSwapStory.to_guard_slot" as explorer_guard_swap_to_guard_slot,
      "story.ExplorerGuardSwapStory.count" as explorer_guard_swap_count,
      "story.GuardExplorerSwapStory.from_structure_id" as guard_explorer_swap_from_structure_id,
      "story.GuardExplorerSwapStory.from_guard_slot" as guard_explorer_swap_from_guard_slot,
      "story.GuardExplorerSwapStory.to_explorer_id" as guard_explorer_swap_to_explorer_id,
      "story.GuardExplorerSwapStory.to_explorer_direction" as guard_explorer_swap_to_explorer_direction,
      "story.GuardExplorerSwapStory.count" as guard_explorer_swap_count,
      "story.PrizeDistributedStory.to_player_address" as prize_to_player_address,
      "story.PrizeDistributedStory.amount" as prize_amount,
      "story.PrizeDistributedStory.decimals" as prize_decimals,
      "story.PrizeDistributionFinalStory.trial_id" as prize_trial_id
`;

export const buildStoryEventsQuery = (limit: number, offset: number): string => `
    SELECT
${STORY_EVENT_SELECT_FIELDS}
    FROM "s1_eternum-StoryEvent"
    ORDER BY timestamp DESC
    LIMIT ${limit}
    OFFSET ${offset}
`;

export const HYPERSTRUCTURE_LEADERBOARD_CONFIG_QUERY = `
    SELECT
      "victory_points_grant_config.hyp_points_per_second" AS points_per_second,
      "season_config.end_at" AS season_end,
      COALESCE("realm_count_config.count", 0) AS realm_count
    FROM "s1_eternum-WorldConfig";
`;

export const ALL_TILES_QUERY = `
    SELECT DISTINCT
      data
    FROM "s1_eternum-TileOpt"
    ORDER BY alt, col, row;
`;

export const HYPERSTRUCTURES_QUERY = `
    SELECT hyperstructure_id
    FROM "s1_eternum-Hyperstructure";
`;

export const STRUCTURE_AND_EXPLORER_DETAILS_QUERY = `
    SELECT
        s.owner AS owner_address,
        GROUP_CONCAT(DISTINCT s.entity_id || ':' || s.\`metadata.realm_id\`|| ':' || s.\`category\`) AS structure_ids,
        GROUP_CONCAT(
            CASE 
                WHEN et.explorer_id IS NOT NULL 
                THEN et.explorer_id || ':' || s.entity_id 
                ELSE NULL 
            END
        ) AS explorer_ids,
        COUNT(DISTINCT CASE WHEN s.category = 1 THEN s.entity_id END) as realms_count,
        COUNT(DISTINCT CASE WHEN s.category = 2 THEN s.entity_id END) as hyperstructures_count,
        COUNT(DISTINCT CASE WHEN s.category = 3 THEN s.entity_id END) as bank_count,
        COUNT(DISTINCT CASE WHEN s.category = 4 THEN s.entity_id END) as mine_count,
        COUNT(DISTINCT CASE WHEN s.category = 5 THEN s.entity_id END) as village_count,
        gm.guild_id,
        g.name AS guild_name,
        sos.name AS player_name
    FROM [s1_eternum-Structure] s
    LEFT JOIN [s1_eternum-ExplorerTroops] et ON et.owner = s.entity_id
    LEFT JOIN [s1_eternum-GuildMember] gm ON gm.member = s.owner
    LEFT JOIN [s1_eternum-Guild] g ON g.guild_id = gm.guild_id
    LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
    GROUP BY s.owner
`;

export const HYPERSTRUCTURE_SHAREHOLDERS_QUERY = `
    SELECT
      hyperstructure_id,
      start_at,
      shareholders
    FROM "s1_eternum-HyperstructureShareholders";
`;

export const HYPERSTRUCTURES_WITH_MULTIPLIER_QUERY = `
    SELECT
      hyperstructure_id,
      points_multiplier
    FROM "s1_eternum-Hyperstructure";
`;
