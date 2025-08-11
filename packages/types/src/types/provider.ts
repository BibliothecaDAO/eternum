import { Account, AccountInterface, BigNumberish } from "starknet";
import { ResourcesIds } from "../constants";
import { BuildingType } from "../constants/structures";
import { Level, Resource } from "./common";

export interface SystemSigner {
  signer: AccountInterface | Account;
}

export interface CreateVillageProps extends SystemSigner {
  village_pass_token_id: BigNumberish;
  connected_realm: BigNumberish;
  direction: BigNumberish;
  village_pass_address: string;
}

export interface MintAndSettleTestRealmProps extends SystemSigner {
  token_id: BigNumberish;
  realms_address: string;
  season_pass_address: string;
  realm_settlement: {
    side: BigNumberish;
    layer: BigNumberish;
    point: BigNumberish;
  };
}

export interface BlitzRealmRegisterProps extends SystemSigner {
  owner: BigNumberish;
  name: BigNumberish;
}

export interface BlitzRealmMakeHyperstructuresProps extends SystemSigner {
  count: BigNumberish;
}

export interface BlitzRealmCreateProps extends SystemSigner {}

export interface BridgeDepositIntoRealmProps extends SystemSigner {
  resources: {
    tokenAddress: BigNumberish;
    amount: BigNumberish;
  }[];
  recipient_structure_id: BigNumberish;
  client_fee_recipient: BigNumberish;
}

export interface BridgeWithdrawFromRealmProps extends SystemSigner {
  resources: {
    tokenAddress: BigNumberish;
    amount: BigNumberish;
  }[];
  from_structure_id: BigNumberish;
  recipient_address: BigNumberish;
  client_fee_recipient: BigNumberish;
}

export interface SetAddressNameProps extends SystemSigner {
  name: BigNumberish;
}

export interface SetEntityNameProps extends SystemSigner {
  entity_id: BigNumberish;
  name: string;
}

export interface CreateOrderProps extends SystemSigner {
  maker_id: BigNumberish;
  taker_id: BigNumberish;
  maker_gives_resource_type: BigNumberish;
  maker_gives_min_resource_amount: BigNumberish;
  maker_gives_max_count: BigNumberish;
  taker_pays_resource_type: BigNumberish;
  taker_pays_min_resource_amount: BigNumberish;
  expires_at: BigNumberish;
}

export interface AcceptOrderProps extends SystemSigner {
  taker_id: BigNumberish;
  trade_id: BigNumberish;
  taker_buys_count: BigNumberish;
}

export interface CancelOrderProps extends SystemSigner {
  trade_id: BigNumberish;
}

export interface SendResourcesProps extends SystemSigner {
  sender_entity_id: BigNumberish;
  recipient_entity_id: BigNumberish;
  resources: ResourceCosts[];
}

export interface SendResourcesMultipleProps extends SystemSigner {
  calls: {
    sender_entity_id: BigNumberish;
    recipient_entity_id: BigNumberish;
    resources: BigNumberish[];
  }[];
}

export interface PickupResourcesProps extends SystemSigner {
  recipient_entity_id: BigNumberish;
  owner_entity_id: BigNumberish;
  resources: ResourceCosts[];
}

export interface ArrivalsOffloadProps extends SystemSigner {
  structureId: BigNumberish;
  day: BigNumberish;
  slot: BigNumberish;
  resource_count: BigNumberish;
}

export interface TransferResourcesProps extends SystemSigner {
  sending_entity_id: BigNumberish;
  receiving_entity_id: BigNumberish;
  resources: BigNumberish[];
}

export interface MintResourcesProps extends SystemSigner {
  receiver_id: BigNumberish;
  resources: BigNumberish[];
}

export interface CreateMultipleRealmsProps extends SystemSigner {
  owner: BigNumberish;
  realms: {
    realm_id: BigNumberish;
    realm_settlement: {
      side: BigNumberish;
      layer: BigNumberish;
      point: BigNumberish;
    };
  }[];
  frontend: BigNumberish;
  season_pass_address: string;
}

export interface CreateRealmDevProps extends SystemSigner {
  realm_id: BigNumberish;
}

export interface UpgradeRealmProps extends SystemSigner {
  realm_entity_id: BigNumberish;
}

export interface CreateBuildingProps extends SystemSigner {
  entity_id: BigNumberish;
  directions: BigNumberish[];
  building_category: BuildingType;
  use_simple: boolean;
}

export interface DestroyBuildingProps extends SystemSigner {
  entity_id: BigNumberish;
  building_coord: {
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface PauseProductionProps extends SystemSigner {
  entity_id: BigNumberish;
  building_coord: {
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface ResumeProductionProps extends SystemSigner {
  entity_id: BigNumberish;
  building_coord: {
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface CreateAdminBanksProps extends SystemSigner {
  banks: {
    name: string;
    coord: {
      x: BigNumberish;
      y: BigNumberish;
    };
  }[];
}

export interface ChangeBankOwnerFeeProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  new_swap_fee_num: BigNumberish;
  new_swap_fee_denom: BigNumberish;
}

export interface ChangeBankBridgeFeeProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  new_bridge_fee_dpt_percent: BigNumberish;
  new_bridge_fee_wtdr_percent: BigNumberish;
}

export interface BuyResourcesProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  entity_id: BigNumberish;
  resource_type: BigNumberish;
  amount: BigNumberish;
}

export interface SellResourcesProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  entity_id: BigNumberish;
  resource_type: BigNumberish;
  amount: BigNumberish;
}

export interface AddLiquidityProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  entity_id: BigNumberish;
  calls: {
    resource_type: BigNumberish;
    resource_amount: BigNumberish;
    lords_amount: BigNumberish;
  }[];
}

export interface RemoveLiquidityProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  entity_id: BigNumberish;
  resource_type: BigNumberish;
  shares: BigNumberish;
}

export interface TroopsLegacy {
  knight_count: BigNumberish;
  paladin_count: BigNumberish;
  crossbowman_count: BigNumberish;
}

export interface ArmyCreateProps extends SystemSigner {
  army_owner_id: BigNumberish;
  is_defensive_army: boolean;
}

export interface ArmyDeleteProps extends SystemSigner {
  army_id: BigNumberish;
}

export interface ArmyBuyTroopsProps extends SystemSigner {
  army_id: BigNumberish;
  payer_id: BigNumberish;
  troops: TroopsLegacy;
}

export interface ArmyMergeTroopsProps extends SystemSigner {
  from_army_id: BigNumberish;
  to_army_id: BigNumberish;
  troops: TroopsLegacy;
}

export interface BattleStartProps extends SystemSigner {
  attacking_army_id: BigNumberish;
  defending_army_id: BigNumberish;
}

export interface BattleForceStartProps extends SystemSigner {
  battle_id: BigNumberish;
  defending_army_id: BigNumberish;
}

export interface BattleResolveProps extends SystemSigner {
  battle_id: BigNumberish;
  army_id: BigNumberish;
}

export interface BattleJoinProps extends SystemSigner {
  battle_id: BigNumberish;
  battle_side: BigNumberish;
  army_id: BigNumberish;
}

export interface BattleLeaveProps extends SystemSigner {
  battle_id: BigNumberish;
  army_ids: BigNumberish[];
}

export interface BattlePillageProps extends SystemSigner {
  army_id: BigNumberish;
  structure_id: BigNumberish;
}

export interface BattleClaimProps extends SystemSigner {
  army_id: BigNumberish;
  structure_id: BigNumberish;
}

type BattleClaimAndLeave = BattleClaimProps & BattleLeaveProps;
export interface BattleClaimAndLeaveProps extends SystemSigner, Omit<BattleClaimAndLeave, "army_ids"> {}

type BattleLeaveAndRaid = BattlePillageProps & BattleLeaveProps;
export interface BattleLeaveAndRaidProps extends SystemSigner, Omit<BattleLeaveAndRaid, "army_ids"> {}

export interface CreateGuildProps extends SystemSigner {
  is_public: boolean;
  guild_name: string;
}
export interface JoinGuildProps extends SystemSigner {
  guild_entity_id: BigNumberish;
}
export interface UpdateWhitelist extends SystemSigner {
  address: BigNumberish;
  whitelist: boolean;
}

export interface TransferGuildOwnership extends SystemSigner {
  guild_entity_id: BigNumberish;
  to_player_address: BigNumberish;
}

export interface RemoveGuildMember extends SystemSigner {
  player_address_to_remove: BigNumberish;
}

export interface DisbandGuild extends SystemSigner {
  calls: { address: BigNumberish }[];
}

export interface RemovePlayerFromWhitelist extends SystemSigner {
  player_address_to_remove: BigNumberish;
  guild_entity_id: BigNumberish;
}

export interface ClaimWonderProductionBonusProps extends SystemSigner {
  structure_id: BigNumberish;
  wonder_structure_id: BigNumberish;
}

export interface MintStartingResources extends SystemSigner {
  config_ids: BigNumberish[];
  realm_entity_id: BigNumberish;
}

interface ResourceCosts {
  resource: ResourcesIds;
  amount: BigNumberish;
}

export interface SetStartingResourcesConfigProps extends SystemSigner {
  realmStartingResources: ResourceCosts[];
  villageStartingResources: ResourceCosts[];
}

export interface SetMapConfigProps extends SystemSigner {
  reward_amount: BigNumberish;
  shards_mines_win_probability: BigNumberish;
  shards_mines_fail_probability: BigNumberish;
  agent_find_probability: BigNumberish;
  agent_find_fail_probability: BigNumberish;
  village_find_probability: BigNumberish;
  village_find_fail_probability: BigNumberish;
  hyps_win_prob: BigNumberish;
  hyps_fail_prob: BigNumberish;
  hyps_fail_prob_increase_p_hex: BigNumberish;
  hyps_fail_prob_increase_p_fnd: BigNumberish;
  relic_discovery_interval_sec: BigNumberish;
  relic_hex_dist_from_center: BigNumberish;
  relic_chest_relics_per_chest: BigNumberish;
}

export interface SetVictoryPointsConfigProps extends SystemSigner {
  points_for_win: BigNumberish;
  hyperstructure_points_per_second: BigNumberish;
  points_for_hyperstructure_claim_against_bandits: BigNumberish;
  points_for_non_hyperstructure_claim_against_bandits: BigNumberish;
  points_for_tile_exploration: BigNumberish;
}

export interface SetBlitzModeConfigProps extends SystemSigner {
  blitz_mode_on: boolean;
}

export interface SetDiscoveredVillageSpawnResourcesConfigProps extends SystemSigner {
  resources: {
    resource: ResourcesIds;
    min_amount: BigNumberish;
    max_amount: BigNumberish;
  }[];
}

export interface SetTravelFoodCostConfigProps extends SystemSigner {
  config_id: BigNumberish;
  unit_type: BigNumberish;
  explore_wheat_burn_amount: BigNumberish;
  explore_fish_burn_amount: BigNumberish;
  travel_wheat_burn_amount: BigNumberish;
  travel_fish_burn_amount: BigNumberish;
}

export interface SetCapacityConfigProps extends SystemSigner {
  troop_capacity: BigNumberish; // grams
  donkey_capacity: BigNumberish; // grams
  storehouse_boost_capacity: BigNumberish; // grams

  realm_capacity: BigNumberish; // grams
  village_capacity: BigNumberish; // grams
  hyperstructure_capacity: BigNumberish; // grams
  fragment_mine_capacity: BigNumberish; // grams
  bank_structure_capacity: BigNumberish; // grams
}

export interface SetAgentConfigProps extends SystemSigner {
  agent_controller: BigNumberish;

  max_lifetime_count: BigNumberish;
  max_current_count: BigNumberish;
  min_spawn_lords_amount: BigNumberish;
  max_spawn_lords_amount: BigNumberish;
}

export interface SetVillageTokenProps extends SystemSigner {
  village_pass_nft_address: BigNumberish;
  village_mint_initial_recipient: BigNumberish;
}

export interface SetWonderBonusConfigProps extends SystemSigner {
  within_tile_distance: BigNumberish;
  bonus_percent_num: BigNumberish;
}

export interface SetTradeConfigProps extends SystemSigner {
  max_count: BigNumberish;
}

export interface SetWeightConfigProps extends SystemSigner {
  calls: {
    entity_type: BigNumberish;
    weight_nanogram: BigNumberish;
  }[];
}

export interface SetTickConfigProps extends SystemSigner {
  tick_interval_in_seconds: BigNumberish;
  delivery_tick_interval_in_seconds: BigNumberish;
}

export interface SetResourceFactoryConfigProps extends SystemSigner {
  calls: {
    resource_type: BigNumberish;
    realm_output_per_second: BigNumberish;
    village_output_per_second: BigNumberish;
    labor_output_per_resource: BigNumberish;
    resource_output_per_simple_input: BigNumberish;
    simple_input_resources_list: ResourceCosts[];
    resource_output_per_complex_input: BigNumberish;
    complex_input_resources_list: ResourceCosts[];
  }[];
}

export interface SetBankConfigProps extends SystemSigner {
  lp_fee_num: BigNumberish;
  lp_fee_denom: BigNumberish;
  owner_fee_num: BigNumberish;
  owner_fee_denom: BigNumberish;
}

export interface SetBattleConfigProps extends SystemSigner {
  regular_immunity_ticks: BigNumberish;
  hyperstructure_immunity_ticks: BigNumberish;
}

export interface SetTroopConfigProps extends SystemSigner {
  stamina_config: TroopStaminaConfigProps;
  limit_config: TroopLimitConfigProps;
  damage_config: TroopDamageConfigProps;
}

export interface TroopStaminaConfigProps {
  stamina_gain_per_tick: BigNumberish;
  stamina_initial: BigNumberish;
  stamina_bonus_value: BigNumberish;
  stamina_knight_max: BigNumberish;
  stamina_paladin_max: BigNumberish;
  stamina_crossbowman_max: BigNumberish;
  stamina_attack_req: BigNumberish;
  stamina_attack_max: BigNumberish;
  stamina_explore_wheat_cost: BigNumberish;
  stamina_explore_fish_cost: BigNumberish;
  stamina_explore_stamina_cost: BigNumberish;
  stamina_travel_wheat_cost: BigNumberish;
  stamina_travel_fish_cost: BigNumberish;
  stamina_travel_stamina_cost: BigNumberish;
}

export interface TroopLimitConfigProps {
  explorer_max_party_count: BigNumberish;
  explorer_guard_max_troop_count: BigNumberish;
  guard_resurrection_delay: BigNumberish;
  mercenaries_troop_lower_bound: BigNumberish;
  mercenaries_troop_upper_bound: BigNumberish;
  agent_troop_lower_bound: BigNumberish;
  agent_troop_upper_bound: BigNumberish;
}

export interface TroopDamageConfigProps {
  damage_raid_percent_num: BigNumberish;
  damage_biome_bonus_num: BigNumberish;
  damage_beta_small: BigNumberish;
  damage_beta_large: BigNumberish;
  damage_scaling_factor: BigNumberish;
  damage_c0: BigNumberish;
  damage_delta: BigNumberish;
  t1_damage_value: BigNumberish;
  t2_damage_multiplier: BigNumberish;
  t3_damage_multiplier: BigNumberish;
}

export interface SetBuildingConfigProps extends SystemSigner {
  base_population: BigNumberish;
  base_cost_percent_increase: BigNumberish;
}

export interface SetBuildingCategoryConfigProps extends SystemSigner {
  calls: {
    building_category: BuildingType;
    complex_building_cost: ResourceCosts[];
    simple_building_cost: ResourceCosts[];
    population_cost: BigNumberish;
    capacity_grant: BigNumberish;
  }[];
}

export interface setRealmUpgradeConfigProps extends SystemSigner {
  calls: {
    level: BigNumberish;
    cost_of_level: ResourceCosts[];
  }[];
}

export interface SetStructureMaxLevelConfigProps extends SystemSigner {
  realm_max_level: BigNumberish;
  village_max_level: BigNumberish;
}

export interface SetWorldConfigProps extends SystemSigner {
  admin_address: BigNumberish;
}

export interface SetMercenariesNameConfigProps extends SystemSigner {
  name: BigNumberish;
}
export interface SetDonkeySpeedConfigProps extends SystemSigner {
  sec_per_km: BigNumberish;
}

export interface SetSeasonConfigProps extends SystemSigner {
  dev_mode_on: boolean;
  season_pass_address: BigNumberish;
  realms_address: BigNumberish;
  lords_address: BigNumberish;
  start_settling_at: BigNumberish;
  start_main_at: BigNumberish;
  end_at: BigNumberish;
  bridge_close_end_grace_seconds: BigNumberish;
  point_registration_grace_seconds: BigNumberish;
}

export interface SetVRFConfigProps extends SystemSigner {
  vrf_provider_address: BigNumberish;
}

export interface SetResourceBridgeWhitelistConfigProps extends SystemSigner {
  resource_whitelist_configs: ResourceWhitelistConfig[];
}

export interface ResourceWhitelistConfig {
  token: BigNumberish;
  resource_type: BigNumberish;
}
export interface SetResourceBridgeFeesConfigProps extends SystemSigner {
  velords_fee_on_dpt_percent: BigNumberish;
  velords_fee_on_wtdr_percent: BigNumberish;
  season_pool_fee_on_dpt_percent: BigNumberish;
  season_pool_fee_on_wtdr_percent: BigNumberish;
  client_fee_on_dpt_percent: BigNumberish;
  client_fee_on_wtdr_percent: BigNumberish;
  velords_fee_recipient: BigNumberish;
  season_pool_fee_recipient: BigNumberish;
  realm_fee_dpt_percent: BigNumberish;
  realm_fee_wtdr_percent: BigNumberish;
}

export interface SetHyperstructureConfig extends SystemSigner {
  initialize_shards_amount: BigNumberish;
  construction_resources: {
    resource_type: BigNumberish;
    resource_completion_points: number;
    min_amount: number;
    max_amount: number;
  }[];
}

export interface SetQuestConfigProps extends SystemSigner {
  quest_find_probability: BigNumberish;
  quest_find_fail_probability: BigNumberish;
}

export interface InitializeHyperstructureProps extends SystemSigner {
  hyperstructure_id: BigNumberish;
}

export interface ContributeToConstructionProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  contributor_entity_id: BigNumberish;
  contributions: { resource: number; amount: number }[];
}

export interface SetAccessProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  access: BigNumberish;
}

export interface GetPointsProps extends SystemSigner {
  player_address: BigNumberish;
  hyperstructure_contributed_to: number[];
  hyperstructure_shareholder_epochs: { hyperstructure_entity_id: number; epoch: number }[];
}
export interface EndGameProps extends SystemSigner {}

export interface RegisterToLeaderboardProps extends SystemSigner {
  hyperstructure_contributed_to: number[];
  hyperstructure_shareholder_epochs: { hyperstructure_entity_id: number; epoch: number }[];
}

export interface ClaimLeaderboardRewardsProps extends SystemSigner {}

export interface SetCoOwnersProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  co_owners: Record<number, BigNumberish>[];
}

export interface ClaimConstructionPointsProps extends SystemSigner {
  hyperstructure_ids: BigNumberish[];
  player: BigNumberish;
}

export interface ClaimSharePointsProps extends SystemSigner {
  hyperstructure_ids: BigNumberish[];
}

export interface SetStaminaConfigProps extends SystemSigner {
  unit_type: BigNumberish;
  max_stamina: BigNumberish;
}

export interface SetStaminaRefillConfigProps extends SystemSigner {
  amount_per_tick: BigNumberish;
  start_boost_tick_count: BigNumberish;
}

export interface SetSettlementConfigProps extends SystemSigner {
  center: BigNumberish;
  base_distance: BigNumberish;
  subsequent_distance: BigNumberish;
}
export interface SetBlitzRegistrationConfigProps extends SystemSigner {
  fee_token: BigNumberish;
  fee_recipient: BigNumberish;
  fee_amount: BigNumberish;
  registration_count_max: BigNumberish;
  registration_start_at: BigNumberish;
}
export interface MintTestRealmProps extends SystemSigner {
  token_id: BigNumberish;
  realms_address: BigNumberish;
}
export interface MintSeasonPassesProps extends SystemSigner {
  recipient: BigNumberish;
  token_ids: BigNumberish[];
  season_pass_address: BigNumberish;
}

export interface AttachLordsProps extends SystemSigner {
  token_id: BigNumberish;
  amount: BigNumberish;
  season_pass_address: BigNumberish;
  lords_address: BigNumberish;
}

export interface DetachLordsProps extends SystemSigner {
  token_id: BigNumberish;
  amount: BigNumberish;
  season_pass_address: BigNumberish;
}

export interface MintTestLordsProps extends SystemSigner {
  lords_address: BigNumberish;
}

/**
 * Props for burning resources to produce labor
 */
export interface BurnOtherResourcesForLaborProductionProps {
  /** ID of the realm entity */
  entity_id: number;
  /** Array of resource types to burn */
  resource_types: number[];
  /** Array of resource amounts to burn */
  resource_amounts: number[];
  /** Account executing the transaction */
  signer: Account | AccountInterface;
}

/**
 * Props for burning labor to produce other resources
 */
export interface BurnLaborResourcesForOtherProductionProps {
  /** ID of the realm entity */
  from_entity_id: number;
  /** Array of cycles to burn */
  production_cycles: number[];
  /** Array of resource types to produce */
  produced_resource_types: number[];
  /** Account executing the transaction */
  signer: Account | AccountInterface;
}

/**
 * Props for burning predefined resources to produce other resources
 */
export interface BurnOtherPredefinedResourcesForResourcesProps {
  /** ID of the realm entity */
  from_entity_id: number;
  /** Array of resource types to produce */
  produced_resource_types: number[];
  /** Array of production cycle counts */
  production_cycles: number[];
  /** Account executing the transaction */
  signer: Account | AccountInterface;
}

/**
 * Properties for moving an explorer
 */
export interface ExplorerMoveProps extends SystemSigner {
  /** ID of the explorer to move */
  explorer_id: number;
  /** Array of directions to move in */
  directions: number[];
  /** Whether to explore new tiles along the way */
  explore: boolean;
}

/**
 * Properties for swapping troops between explorers
 */
export interface ExplorerExplorerSwapProps extends SystemSigner {
  /** ID of the explorer sending troops */
  from_explorer_id: number;
  /** ID of the explorer receiving troops */
  to_explorer_id: number;
  /** Direction to the receiving explorer */
  to_explorer_direction: number;
  /** Number of troops to swap */
  count: number;
}

/**
 * Properties for swapping troops from explorer to guard
 */
export interface ExplorerGuardSwapProps extends SystemSigner {
  /** ID of the explorer sending troops */
  from_explorer_id: number;
  /** ID of the structure receiving troops */
  to_structure_id: number;
  /** Direction to the receiving structure */
  to_structure_direction: number;
  /** Guard slot to place troops in */
  to_guard_slot: number;
  /** Number of troops to swap */
  count: number;
}

/**
 * Properties for swapping troops from guard to explorer
 */
export interface GuardExplorerSwapProps extends SystemSigner {
  /** ID of the structure sending troops */
  from_structure_id: number;
  /** Guard slot to take troops from */
  from_guard_slot: number;
  /** ID of the explorer receiving troops */
  to_explorer_id: number;
  /** Direction to the receiving explorer */
  to_explorer_direction: number;
  /** Number of troops to swap */
  count: number;
}

/**
 * Properties for explorer vs explorer attack
 */
export interface AttackExplorerVsExplorerProps extends SystemSigner {
  /** ID of the attacking explorer */
  aggressor_id: number;
  /** ID of the defending explorer */
  defender_id: number;
  /** Direction to the defender */
  defender_direction: number;
  /** Resources to steal */
  steal_resources: Resource[];
}

/**
 * Properties for explorer vs guard attack
 */
export interface AttackExplorerVsGuardProps extends SystemSigner {
  /** ID of the attacking explorer */
  explorer_id: number;
  /** ID of the structure with defending guard */
  structure_id: number;
  /** Direction to the structure */
  structure_direction: number;
}

/**
 * Properties for guard vs explorer attack
 */
export interface AttackGuardVsExplorerProps extends SystemSigner {
  /** ID of the structure with attacking guard */
  structure_id: number;
  /** Guard slot of the attacking troops */
  structure_guard_slot: number;
  /** ID of the defending explorer */
  explorer_id: number;
  /** Direction to the explorer */
  explorer_direction: number;
}

/**
 * Properties for raid explorer vs guard
 */
export interface RaidExplorerVsGuardProps extends SystemSigner {
  /** ID of the raiding explorer */
  explorer_id: number;
  /** ID of the structure being raided */
  structure_id: number;
  /** Direction to the structure */
  structure_direction: number;
  /** Resources to steal */
  steal_resources: Resource[];
}

/**
 * Properties for adding troops to a guard
 */
export interface GuardAddProps extends SystemSigner {
  /** ID of the structure to add guard troops to */
  for_structure_id: number;
  /** Guard slot to place troops in */
  slot: number;
  /** Type of troops to add */
  category: number;
  /** Tier of troops to add */
  tier: number;
  /** Number of troops to add */
  amount: number;
}

/**
 * Properties for deleting guard troops
 */
export interface GuardDeleteProps extends SystemSigner {
  /** ID of the structure to remove guard troops from */
  for_structure_id: number;
  /** Guard slot to remove troops from */
  slot: number;
}

/**
 * Properties for creating an explorer
 */
export interface ExplorerCreateProps extends SystemSigner {
  /** ID of the structure creating the explorer */
  for_structure_id: number;
  /** Type of troops to add */
  category: number;
  /** Tier of troops to add */
  tier: number;
  /** Number of troops to add */
  amount: number;
  /** Direction to spawn the explorer */
  spawn_direction: number;
}

/**
 * Properties for adding troops to an explorer
 */
export interface ExplorerAddProps extends SystemSigner {
  /** ID of the explorer to add troops to */
  to_explorer_id: number;
  /** Number of troops to add */
  amount: number;
  /** Direction to the explorer's home */
  home_direction: number;
}

/**
 * Properties for deleting an explorer
 */
export interface ExplorerDeleteProps extends SystemSigner {
  /** ID of the explorer to delete */
  explorer_id: number;
}

/**
 * Properties for transferring resources from a troop to an adjacent structure
 */
export interface TroopStructureAdjacentTransferProps extends SystemSigner {
  /** ID of the explorer sending resources */
  from_explorer_id: number;
  /** ID of the structure receiving resources */
  to_structure_id: number;
  /** Resources to transfer */
  resources: Resource[];
}

/**
 * Properties for transferring resources from a troop to an adjacent troop
 */
export interface TroopTroopAdjacentTransferProps extends SystemSigner {
  /** ID of the troop sending resources */
  from_troop_id: number;
  /** ID of the troop receiving resources */
  to_troop_id: number;
  /** Resources to transfer */
  resources: Resource[];
}

/**
 * Properties for transferring resources from a structure to an adjacent troop
 */
export interface StructureTroopAdjacentTransferProps extends SystemSigner {
  /** ID of the structure sending resources */
  from_structure_id: number;
  /** ID of the troop receiving resources */
  to_troop_id: number;
  /** Resources to transfer */
  resources: Resource[];
}

export interface CreateMarketplaceOrdersProps {
  marketplace_address: BigNumberish;
  tokens: {
    token_id: number;
    collection_id: number;
    price: BigNumberish;
    expiration: number;
    cancel_order_id?: BigNumberish | null;
  }[];
  signer: AccountInterface;
}

export interface AcceptMarketplaceOrdersProps {
  marketplace_address: BigNumberish;
  order_ids: BigNumberish[];
  signer: AccountInterface;
}

export interface CancelMarketplaceOrderProps {
  marketplace_address: BigNumberish;
  order_id: BigNumberish;
  signer: AccountInterface;
}

export interface EditMarketplaceOrderProps {
  marketplace_address: BigNumberish;
  order_id: BigNumberish;
  new_price: BigNumberish;
  signer: AccountInterface;
}

export interface LeaveGuildProps extends SystemSigner {}

export interface SetQuestGamesProps extends SystemSigner {
  quest_games: {
    address: string;
    levels: Level[];
    overwrite: boolean;
  }[];
}

export interface StartQuestProps extends SystemSigner {
  quest_tile_id: number;
  explorer_id: number;
  player_name: BigNumberish;
  to_address: string;
}

export interface ClaimRewardProps extends SystemSigner {
  game_token_id: number;
  game_address: string;
}

export interface GetGameCountProps extends SystemSigner {
  game_address: string;
}

export interface DisableQuestsProps extends SystemSigner {}

export interface EnableQuestsProps extends SystemSigner {}

export interface TransferStructureOwnershipProps extends SystemSigner {
  structure_id: BigNumberish;
  new_owner: BigNumberish;
}

export interface TransferAgentOwnershipProps extends SystemSigner {
  explorer_id: BigNumberish;
  new_owner: BigNumberish;
}

export interface StructureBurnProps extends SystemSigner {
  structure_id: BigNumberish;
  resources: Resource[];
}

export interface TroopBurnProps extends SystemSigner {
  explorer_id: BigNumberish;
  resources: Resource[];
}

export interface OpenChestProps extends SystemSigner {
  explorer_id: BigNumberish;
  chest_coord: {
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface ApplyRelicProps extends SystemSigner {
  entity_id: BigNumberish;
  relic_resource_id: BigNumberish;
  recipient_type: BigNumberish;
}
