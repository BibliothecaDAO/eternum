const STORY_EVENT_SELECT_FIELDS = `
      "owner.Some" as owner,
      "entity_id.Some" as entity_id,
      tx_hash,
      story,
      timestamp,
      internal_event_id as event_id,
      -- RealmCreatedStory fields
      "story.RealmCreatedStory.coord.x" as realm_coord_x,
      "story.RealmCreatedStory.coord.y" as realm_coord_y,
      -- ExplorerMoveStory fields
      "story.ExplorerMoveStory.explorer_id" as explorer_id,
      "story.ExplorerMoveStory.explorer_structure_id" as explorer_structure_id,
      "story.ExplorerMoveStory.start_coord.x" as start_coord_x,
      "story.ExplorerMoveStory.start_coord.y" as start_coord_y,
      "story.ExplorerMoveStory.end_coord.x" as end_coord_x,
      "story.ExplorerMoveStory.end_coord.y" as end_coord_y,
      "story.ExplorerMoveStory.directions" as explorer_directions,
      "story.ExplorerMoveStory.explore" as explorer_explore,
      "story.ExplorerMoveStory.explore_find" as explore_find,
      "story.ExplorerMoveStory.reward_resource_type" as reward_resource_type,
      "story.ExplorerMoveStory.reward_resource_amount" as reward_resource_amount,
      -- StructureLevelUpStory fields
      "story.StructureLevelUpStory.new_level" as structure_new_level,
      -- BattleStory fields
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
      -- ProductionStory fields
      "story.ProductionStory.received_resource_type" as production_resource_type,
      "story.ProductionStory.received_amount" as production_amount,
      "story.ProductionStory.cost" as production_cost,
      -- BuildingPlacementStory fields
      "story.BuildingPlacementStory.category" as building_category,
      "story.BuildingPlacementStory.inner_coord.x" as building_coord_x,
      "story.BuildingPlacementStory.inner_coord.y" as building_coord_y,
      "story.BuildingPlacementStory.created" as building_created,
      "story.BuildingPlacementStory.destroyed" as building_destroyed,
      "story.BuildingPlacementStory.paused" as building_paused,
      "story.BuildingPlacementStory.unpaused" as building_unpaused,
      -- BuildingPaymentStory fields
      "story.BuildingPaymentStory.category" as building_payment_category,
      "story.BuildingPaymentStory.inner_coord.x" as building_payment_coord_x,
      "story.BuildingPaymentStory.inner_coord.y" as building_payment_coord_y,
      "story.BuildingPaymentStory.cost" as building_payment_cost,
      -- ResourceTransferStory fields
      "story.ResourceTransferStory.transfer_type" as resource_transfer_type,
      "story.ResourceTransferStory.from_entity_id" as resource_transfer_from_entity_id,
      "story.ResourceTransferStory.from_entity_owner_address" as resource_transfer_from_owner_address,
      "story.ResourceTransferStory.to_entity_id" as resource_transfer_to_entity_id,
      "story.ResourceTransferStory.to_entity_owner_address" as resource_transfer_to_owner_address,
      "story.ResourceTransferStory.resources" as resource_transfer_resources,
      "story.ResourceTransferStory.is_mint" as resource_transfer_is_mint,
      "story.ResourceTransferStory.travel_time" as resource_transfer_travel_time,
      -- ResourceBurnStory fields
      "story.ResourceBurnStory.resources" as resource_burn_resources,
      -- ResourceReceiveArrivalStory fields
      "story.ResourceReceiveArrivalStory.resources" as resource_receive_resources,
      -- GuardAddStory fields
      "story.GuardAddStory.structure_id" as guard_add_structure_id,
      "story.GuardAddStory.slot" as guard_add_slot,
      "story.GuardAddStory.category" as guard_add_category,
      "story.GuardAddStory.tier" as guard_add_tier,
      "story.GuardAddStory.amount" as guard_add_amount,
      -- GuardDeleteStory fields
      "story.GuardDeleteStory.structure_id" as guard_delete_structure_id,
      "story.GuardDeleteStory.slot" as guard_delete_slot,
      -- ExplorerCreateStory fields
      "story.ExplorerCreateStory.structure_id" as explorer_create_structure_id,
      "story.ExplorerCreateStory.explorer_id" as explorer_create_explorer_id,
      "story.ExplorerCreateStory.category" as explorer_create_category,
      "story.ExplorerCreateStory.tier" as explorer_create_tier,
      "story.ExplorerCreateStory.amount" as explorer_create_amount,
      "story.ExplorerCreateStory.spawn_direction" as explorer_create_spawn_direction,
      -- ExplorerAddStory fields
      "story.ExplorerAddStory.explorer_id" as explorer_add_explorer_id,
      "story.ExplorerAddStory.amount" as explorer_add_amount,
      "story.ExplorerAddStory.home_direction" as explorer_add_home_direction,
      -- ExplorerDeleteStory fields
      "story.ExplorerDeleteStory.explorer_id" as explorer_delete_explorer_id,
      -- ExplorerExplorerSwapStory fields
      "story.ExplorerExplorerSwapStory.from_explorer_id" as explorer_swap_from_id,
      "story.ExplorerExplorerSwapStory.to_explorer_id" as explorer_swap_to_id,
      "story.ExplorerExplorerSwapStory.to_explorer_direction" as explorer_swap_to_direction,
      "story.ExplorerExplorerSwapStory.count" as explorer_swap_count,
      -- ExplorerGuardSwapStory fields
      "story.ExplorerGuardSwapStory.from_explorer_id" as explorer_guard_swap_from_explorer_id,
      "story.ExplorerGuardSwapStory.to_structure_id" as explorer_guard_swap_to_structure_id,
      "story.ExplorerGuardSwapStory.to_structure_direction" as explorer_guard_swap_to_structure_direction,
      "story.ExplorerGuardSwapStory.to_guard_slot" as explorer_guard_swap_to_guard_slot,
      "story.ExplorerGuardSwapStory.count" as explorer_guard_swap_count,
      -- GuardExplorerSwapStory fields
      "story.GuardExplorerSwapStory.from_structure_id" as guard_explorer_swap_from_structure_id,
      "story.GuardExplorerSwapStory.from_guard_slot" as guard_explorer_swap_from_guard_slot,
      "story.GuardExplorerSwapStory.to_explorer_id" as guard_explorer_swap_to_explorer_id,
      "story.GuardExplorerSwapStory.to_explorer_direction" as guard_explorer_swap_to_explorer_direction,
      "story.GuardExplorerSwapStory.count" as guard_explorer_swap_count,
      -- Prize Distribution fields
      "story.PrizeDistributedStory.to_player_address" as prize_to_player_address,
      "story.PrizeDistributedStory.amount" as prize_amount,
      "story.PrizeDistributedStory.decimals" as prize_decimals,
      "story.PrizeDistributionFinalStory.trial_id" as prize_trial_id
`;

export const STORY_QUERIES = {
  /**
   * Fetches all story events ordered by timestamp descending (newest first)
   * with optional limit for pagination
   */
  ALL_STORY_EVENTS: `
    SELECT
${STORY_EVENT_SELECT_FIELDS}
    FROM "s1_eternum-StoryEvent"
    ORDER BY timestamp DESC
    LIMIT {limit}
    OFFSET {offset}
  `,

  /**
   * Fetches story events with timestamp greater than provided timestamp
   * Used for auto-refresh to get only new events
   */
  STORY_EVENTS_SINCE: `
    SELECT
${STORY_EVENT_SELECT_FIELDS}
    FROM "s1_eternum-StoryEvent"
    WHERE timestamp > {timestamp}
    ORDER BY timestamp DESC
  `,

  /**
   * Fetches story events by entity ID
   * Useful for filtering events by specific entity
   */
  STORY_EVENTS_BY_ENTITY: `
    SELECT
${STORY_EVENT_SELECT_FIELDS}
    FROM "s1_eternum-StoryEvent"
    WHERE "entity_id.Some" = {entityId}
    ORDER BY timestamp DESC
    LIMIT {limit}
    OFFSET {offset}
  `,

  /**
   * Fetches story events by owner address
   * Useful for filtering events by specific player
   */
  STORY_EVENTS_BY_OWNER: `
    SELECT
${STORY_EVENT_SELECT_FIELDS}
    FROM "s1_eternum-StoryEvent"
    WHERE "owner.Some" = '{owner}'
    ORDER BY timestamp DESC
    LIMIT {limit}
    OFFSET {offset}
  `,

  /**
   * Counts total number of story events
   * Used for pagination calculations
   */
  STORY_EVENTS_COUNT: `
    SELECT COUNT(*) as total_count
    FROM "s1_eternum-StoryEvent"
  `,

  /**
   * Fetches story events by type (e.g., only ExplorerMoveStory events)
   */
  STORY_EVENTS_BY_TYPE: `
    SELECT
${STORY_EVENT_SELECT_FIELDS}
    FROM "s1_eternum-StoryEvent"
    WHERE story = '{storyType}'
    ORDER BY timestamp DESC
    LIMIT {limit}
    OFFSET {offset}
  `,
};
