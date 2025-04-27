import { Account, AccountInterface, BigNumberish, num } from "starknet";
import { ResourcesIds } from "../constants";
import { BuildingType } from "../constants/structures";
import { Level, Resource } from "./common";

export interface SystemSigner {
  signer: AccountInterface | Account;
}

export interface CreateVillageProps extends SystemSigner {
  village_pass_token_id: num.BigNumberish;
  connected_realm: num.BigNumberish;
  direction: num.BigNumberish;
  village_pass_address: string;
}

export interface MintAndSettleTestRealmProps extends SystemSigner {
  token_id: num.BigNumberish;
  realms_address: string;
  season_pass_address: string;
  realm_settlement: {
    side: num.BigNumberish;
    layer: num.BigNumberish;
    point: num.BigNumberish;
  };
}

export interface BridgeDepositIntoRealmProps extends SystemSigner {
  resources: {
    tokenAddress: num.BigNumberish;
    amount: num.BigNumberish;
  }[];
  recipient_structure_id: num.BigNumberish;
  client_fee_recipient: num.BigNumberish;
}

export interface BridgeWithdrawFromRealmProps extends SystemSigner {
  resources: {
    tokenAddress: num.BigNumberish;
    amount: num.BigNumberish;
  }[];
  from_structure_id: num.BigNumberish;
  recipient_address: num.BigNumberish;
  client_fee_recipient: num.BigNumberish;
}

export interface SetAddressNameProps extends SystemSigner {
  name: num.BigNumberish;
}

export interface SetEntityNameProps extends SystemSigner {
  entity_id: num.BigNumberish;
  name: string;
}

export interface CreateOrderProps extends SystemSigner {
  maker_id: num.BigNumberish;
  taker_id: num.BigNumberish;
  maker_gives_resource_type: num.BigNumberish;
  maker_gives_min_resource_amount: num.BigNumberish;
  maker_gives_max_count: num.BigNumberish;
  taker_pays_resource_type: num.BigNumberish;
  taker_pays_min_resource_amount: num.BigNumberish;
  expires_at: num.BigNumberish;
}

export interface AcceptOrderProps extends SystemSigner {
  taker_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  taker_buys_count: num.BigNumberish;
}

export interface CancelOrderProps extends SystemSigner {
  trade_id: num.BigNumberish;
}

export interface SendResourcesProps extends SystemSigner {
  sender_entity_id: num.BigNumberish;
  recipient_entity_id: num.BigNumberish;
  resources: ResourceCosts[];
}

export interface SendResourcesMultipleProps extends SystemSigner {
  calls: {
    sender_entity_id: num.BigNumberish;
    recipient_entity_id: num.BigNumberish;
    resources: num.BigNumberish[];
  }[];
}

export interface PickupResourcesProps extends SystemSigner {
  recipient_entity_id: num.BigNumberish;
  owner_entity_id: num.BigNumberish;
  resources: ResourceCosts[];
}

export interface ArrivalsOffloadProps extends SystemSigner {
  structureId: num.BigNumberish;
  day: num.BigNumberish;
  slot: num.BigNumberish;
  resource_count: num.BigNumberish;
}

export interface TransferResourcesProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  receiving_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface MintResourcesProps extends SystemSigner {
  receiver_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface CreateMultipleRealmsProps extends SystemSigner {
  owner: num.BigNumberish;
  realms: {
    realm_id: num.BigNumberish;
    realm_settlement: {
      side: num.BigNumberish;
      layer: num.BigNumberish;
      point: num.BigNumberish;
    };
  }[];
  frontend: num.BigNumberish;
  season_pass_address: string;
}

export interface CreateRealmDevProps extends SystemSigner {
  realm_id: num.BigNumberish;
}

export interface UpgradeRealmProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
}

export interface CreateBuildingProps extends SystemSigner {
  entity_id: num.BigNumberish;
  directions: num.BigNumberish[];
  building_category: BuildingType;
  use_simple: boolean;
}

export interface DestroyBuildingProps extends SystemSigner {
  entity_id: num.BigNumberish;
  building_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
}

export interface PauseProductionProps extends SystemSigner {
  entity_id: num.BigNumberish;
  building_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
}

export interface ResumeProductionProps extends SystemSigner {
  entity_id: num.BigNumberish;
  building_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
}

export interface CreateAdminBanksProps extends SystemSigner {
  banks: {
    name: string;
    coord: {
      x: num.BigNumberish;
      y: num.BigNumberish;
    };
  }[];
}

export interface ChangeBankOwnerFeeProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  new_swap_fee_num: num.BigNumberish;
  new_swap_fee_denom: num.BigNumberish;
}

export interface ChangeBankBridgeFeeProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  new_bridge_fee_dpt_percent: num.BigNumberish;
  new_bridge_fee_wtdr_percent: num.BigNumberish;
}

export interface BuyResourcesProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  amount: num.BigNumberish;
}

export interface SellResourcesProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  amount: num.BigNumberish;
}

export interface AddLiquidityProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  entity_id: num.BigNumberish;
  calls: {
    resource_type: num.BigNumberish;
    resource_amount: num.BigNumberish;
    lords_amount: num.BigNumberish;
  }[];
}

export interface RemoveLiquidityProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  shares: num.BigNumberish;
}

export interface TroopsLegacy {
  knight_count: num.BigNumberish;
  paladin_count: num.BigNumberish;
  crossbowman_count: num.BigNumberish;
}

export interface ArmyCreateProps extends SystemSigner {
  army_owner_id: num.BigNumberish;
  is_defensive_army: boolean;
}

export interface ArmyDeleteProps extends SystemSigner {
  army_id: num.BigNumberish;
}

export interface ArmyBuyTroopsProps extends SystemSigner {
  army_id: num.BigNumberish;
  payer_id: num.BigNumberish;
  troops: TroopsLegacy;
}

export interface ArmyMergeTroopsProps extends SystemSigner {
  from_army_id: num.BigNumberish;
  to_army_id: num.BigNumberish;
  troops: TroopsLegacy;
}

export interface BattleStartProps extends SystemSigner {
  attacking_army_id: num.BigNumberish;
  defending_army_id: num.BigNumberish;
}

export interface BattleForceStartProps extends SystemSigner {
  battle_id: num.BigNumberish;
  defending_army_id: num.BigNumberish;
}

export interface BattleResolveProps extends SystemSigner {
  battle_id: num.BigNumberish;
  army_id: num.BigNumberish;
}

export interface BattleJoinProps extends SystemSigner {
  battle_id: num.BigNumberish;
  battle_side: num.BigNumberish;
  army_id: num.BigNumberish;
}

export interface BattleLeaveProps extends SystemSigner {
  battle_id: num.BigNumberish;
  army_ids: num.BigNumberish[];
}

export interface BattlePillageProps extends SystemSigner {
  army_id: num.BigNumberish;
  structure_id: num.BigNumberish;
}

export interface BattleClaimProps extends SystemSigner {
  army_id: num.BigNumberish;
  structure_id: num.BigNumberish;
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
  guild_entity_id: num.BigNumberish;
}
export interface UpdateWhitelist extends SystemSigner {
  address: num.BigNumberish;
  whitelist: boolean;
}

export interface TransferGuildOwnership extends SystemSigner {
  guild_entity_id: num.BigNumberish;
  to_player_address: num.BigNumberish;
}

export interface RemoveGuildMember extends SystemSigner {
  player_address_to_remove: num.BigNumberish;
}

export interface DisbandGuild extends SystemSigner {
  calls: { address: num.BigNumberish }[];
}

export interface RemovePlayerFromWhitelist extends SystemSigner {
  player_address_to_remove: num.BigNumberish;
  guild_entity_id: num.BigNumberish;
}

export interface MintStartingResources extends SystemSigner {
  config_ids: num.BigNumberish[];
  realm_entity_id: num.BigNumberish;
}

interface ResourceCosts {
  resource: ResourcesIds;
  amount: num.BigNumberish;
}

export interface SetStartingResourcesConfigProps extends SystemSigner {
  realmStartingResources: ResourceCosts[];
  villageStartingResources: ResourceCosts[];
}

export interface SetMapConfigProps extends SystemSigner {
  reward_amount: num.BigNumberish;
  shards_mines_win_probability: num.BigNumberish;
  shards_mines_fail_probability: num.BigNumberish;
  agent_find_probability: num.BigNumberish;
  agent_find_fail_probability: num.BigNumberish;
  hyps_win_prob: num.BigNumberish;
  hyps_fail_prob: num.BigNumberish;
  hyps_fail_prob_increase_p_hex: num.BigNumberish;
  hyps_fail_prob_increase_p_fnd: num.BigNumberish;
  mine_wheat_grant_amount: num.BigNumberish;
  mine_fish_grant_amount: num.BigNumberish;
}

export interface SetTravelFoodCostConfigProps extends SystemSigner {
  config_id: num.BigNumberish;
  unit_type: num.BigNumberish;
  explore_wheat_burn_amount: num.BigNumberish;
  explore_fish_burn_amount: num.BigNumberish;
  travel_wheat_burn_amount: num.BigNumberish;
  travel_fish_burn_amount: num.BigNumberish;
}

export interface SetCapacityConfigProps extends SystemSigner {
  troop_capacity: num.BigNumberish; // grams
  donkey_capacity: num.BigNumberish; // grams
  storehouse_boost_capacity: num.BigNumberish; // grams

  realm_capacity: num.BigNumberish; // grams
  village_capacity: num.BigNumberish; // grams
  hyperstructure_capacity: num.BigNumberish; // grams
  fragment_mine_capacity: num.BigNumberish; // grams
  bank_structure_capacity: num.BigNumberish; // grams
}

export interface SetAgentConfigProps extends SystemSigner {
  agent_controller: num.BigNumberish;

  max_lifetime_count: num.BigNumberish;
  max_current_count: num.BigNumberish;
  min_spawn_lords_amount: num.BigNumberish;
  max_spawn_lords_amount: num.BigNumberish;
}

export interface SetVillageTokenProps extends SystemSigner {
  village_pass_nft_address: num.BigNumberish;
  village_mint_initial_recipient: num.BigNumberish;
}

export interface SetWonderBonusConfigProps extends SystemSigner {
  within_tile_distance: num.BigNumberish;
  bonus_percent_num: num.BigNumberish;
}

export interface SetTradeConfigProps extends SystemSigner {
  max_count: num.BigNumberish;
}

export interface SetWeightConfigProps extends SystemSigner {
  calls: {
    entity_type: num.BigNumberish;
    weight_nanogram: num.BigNumberish;
  }[];
}

export interface SetTickConfigProps extends SystemSigner {
  tick_interval_in_seconds: num.BigNumberish;
}

export interface SetResourceFactoryConfigProps extends SystemSigner {
  calls: {
    resource_type: num.BigNumberish;
    realm_output_per_second: num.BigNumberish;
    village_output_per_second: num.BigNumberish;
    labor_output_per_resource: num.BigNumberish;
    resource_output_per_simple_input: num.BigNumberish;
    simple_input_resources_list: ResourceCosts[];
    resource_output_per_complex_input: num.BigNumberish;
    complex_input_resources_list: ResourceCosts[];
  }[];
}

export interface SetBankConfigProps extends SystemSigner {
  lp_fee_num: num.BigNumberish;
  lp_fee_denom: num.BigNumberish;
  owner_fee_num: num.BigNumberish;
  owner_fee_denom: num.BigNumberish;
}

export interface SetBattleConfigProps extends SystemSigner {
  regular_immunity_ticks: num.BigNumberish;
  hyperstructure_immunity_ticks: num.BigNumberish;
}

export interface SetTroopConfigProps extends SystemSigner {
  stamina_config: TroopStaminaConfigProps;
  limit_config: TroopLimitConfigProps;
  damage_config: TroopDamageConfigProps;
}

export interface TroopStaminaConfigProps {
  stamina_gain_per_tick: num.BigNumberish;
  stamina_initial: num.BigNumberish;
  stamina_bonus_value: num.BigNumberish;
  stamina_knight_max: num.BigNumberish;
  stamina_paladin_max: num.BigNumberish;
  stamina_crossbowman_max: num.BigNumberish;
  stamina_attack_req: num.BigNumberish;
  stamina_attack_max: num.BigNumberish;
  stamina_explore_wheat_cost: num.BigNumberish;
  stamina_explore_fish_cost: num.BigNumberish;
  stamina_explore_stamina_cost: num.BigNumberish;
  stamina_travel_wheat_cost: num.BigNumberish;
  stamina_travel_fish_cost: num.BigNumberish;
  stamina_travel_stamina_cost: num.BigNumberish;
}

export interface TroopLimitConfigProps {
  explorer_max_party_count: num.BigNumberish;
  explorer_guard_max_troop_count: num.BigNumberish;
  guard_resurrection_delay: num.BigNumberish;
  mercenaries_troop_lower_bound: num.BigNumberish;
  mercenaries_troop_upper_bound: num.BigNumberish;
  agent_troop_lower_bound: num.BigNumberish;
  agent_troop_upper_bound: num.BigNumberish;
}

export interface TroopDamageConfigProps {
  damage_raid_percent_num: num.BigNumberish;
  damage_biome_bonus_num: num.BigNumberish;
  damage_beta_small: num.BigNumberish;
  damage_beta_large: num.BigNumberish;
  damage_scaling_factor: num.BigNumberish;
  damage_c0: num.BigNumberish;
  damage_delta: num.BigNumberish;
  t1_damage_value: num.BigNumberish;
  t2_damage_multiplier: num.BigNumberish;
  t3_damage_multiplier: num.BigNumberish;
}

export interface SetBuildingConfigProps extends SystemSigner {
  base_population: num.BigNumberish;
  base_cost_percent_increase: num.BigNumberish;
}

export interface SetBuildingCategoryConfigProps extends SystemSigner {
  calls: {
    building_category: BuildingType;
    complex_building_cost: ResourceCosts[];
    simple_building_cost: ResourceCosts[];
    population_cost: num.BigNumberish;
    capacity_grant: num.BigNumberish;
  }[];
}

export interface setRealmUpgradeConfigProps extends SystemSigner {
  calls: {
    level: num.BigNumberish;
    cost_of_level: ResourceCosts[];
  }[];
}

export interface SetStructureMaxLevelConfigProps extends SystemSigner {
  realm_max_level: num.BigNumberish;
  village_max_level: num.BigNumberish;
}

export interface SetWorldConfigProps extends SystemSigner {
  admin_address: num.BigNumberish;
}

export interface SetMercenariesNameConfigProps extends SystemSigner {
  name: num.BigNumberish;
}
export interface SetDonkeySpeedConfigProps extends SystemSigner {
  sec_per_km: num.BigNumberish;
}

export interface SetSeasonConfigProps extends SystemSigner {
  season_pass_address: num.BigNumberish;
  realms_address: num.BigNumberish;
  lords_address: num.BigNumberish;
  start_settling_at: num.BigNumberish;
  start_main_at: num.BigNumberish;
  end_grace_seconds: num.BigNumberish;
}

export interface SetVRFConfigProps extends SystemSigner {
  vrf_provider_address: num.BigNumberish;
}

export interface SetResourceBridgeWhitelistConfigProps extends SystemSigner {
  resource_whitelist_configs: ResourceWhitelistConfig[];
}

export interface ResourceWhitelistConfig {
  token: num.BigNumberish;
  resource_type: num.BigNumberish;
}
export interface SetResourceBridgeFeesConfigProps extends SystemSigner {
  velords_fee_on_dpt_percent: num.BigNumberish;
  velords_fee_on_wtdr_percent: num.BigNumberish;
  season_pool_fee_on_dpt_percent: num.BigNumberish;
  season_pool_fee_on_wtdr_percent: num.BigNumberish;
  client_fee_on_dpt_percent: num.BigNumberish;
  client_fee_on_wtdr_percent: num.BigNumberish;
  velords_fee_recipient: num.BigNumberish;
  season_pool_fee_recipient: num.BigNumberish;
  realm_fee_dpt_percent: num.BigNumberish;
  realm_fee_wtdr_percent: num.BigNumberish;
}

export interface SetHyperstructureConfig extends SystemSigner {
  initialize_shards_amount: num.BigNumberish;
  construction_resources: {
    resource_type: num.BigNumberish;
    resource_completion_points: number;
    min_amount: number;
    max_amount: number;
  }[];
  points_per_second: num.BigNumberish;
  points_for_win: num.BigNumberish;
}

export interface SetQuestConfigProps extends SystemSigner {
  quest_find_probability: num.BigNumberish;
  quest_find_fail_probability: num.BigNumberish;
}

export interface InitializeHyperstructureProps extends SystemSigner {
  hyperstructure_id: num.BigNumberish;
}

export interface ContributeToConstructionProps extends SystemSigner {
  hyperstructure_entity_id: num.BigNumberish;
  contributor_entity_id: num.BigNumberish;
  contributions: { resource: number; amount: number }[];
}

export interface SetAccessProps extends SystemSigner {
  hyperstructure_entity_id: num.BigNumberish;
  access: num.BigNumberish;
}

export interface GetPointsProps extends SystemSigner {
  player_address: num.BigNumberish;
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
  hyperstructure_entity_id: num.BigNumberish;
  co_owners: Record<number, BigNumberish>[];
}

export interface ClaimConstructionPointsProps extends SystemSigner {
  hyperstructure_ids: num.BigNumberish[];
  player: num.BigNumberish;
}

export interface ClaimSharePointsProps extends SystemSigner {
  hyperstructure_ids: num.BigNumberish[];
}

export interface SetStaminaConfigProps extends SystemSigner {
  unit_type: num.BigNumberish;
  max_stamina: num.BigNumberish;
}

export interface SetStaminaRefillConfigProps extends SystemSigner {
  amount_per_tick: num.BigNumberish;
  start_boost_tick_count: num.BigNumberish;
}

export interface SetSettlementConfigProps extends SystemSigner {
  center: num.BigNumberish;
  base_distance: num.BigNumberish;
  subsequent_distance: num.BigNumberish;
}

export interface MintTestRealmProps extends SystemSigner {
  token_id: num.BigNumberish;
  realms_address: num.BigNumberish;
}
export interface MintSeasonPassesProps extends SystemSigner {
  recipient: num.BigNumberish;
  token_ids: num.BigNumberish[];
  season_pass_address: num.BigNumberish;
}

export interface AttachLordsProps extends SystemSigner {
  token_id: num.BigNumberish;
  amount: num.BigNumberish;
  season_pass_address: num.BigNumberish;
  lords_address: num.BigNumberish;
}

export interface DetachLordsProps extends SystemSigner {
  token_id: num.BigNumberish;
  amount: num.BigNumberish;
  season_pass_address: num.BigNumberish;
}

export interface MintTestLordsProps extends SystemSigner {
  lords_address: num.BigNumberish;
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

export interface CreateMarketplaceOrderProps {
  marketplace_address: num.BigNumberish;
  token_id: number;
  collection_id: number;
  price: num.BigNumberish;
  expiration: number;
  signer: AccountInterface;
}

export interface AcceptMarketplaceOrderProps {
  marketplace_address: num.BigNumberish;
  order_id: num.BigNumberish;
  signer: AccountInterface;
}

export interface CancelMarketplaceOrderProps {
  marketplace_address: num.BigNumberish;
  order_id: num.BigNumberish;
  signer: AccountInterface;
}

export interface EditMarketplaceOrderProps {
  marketplace_address: num.BigNumberish;
  order_id: num.BigNumberish;
  new_price: num.BigNumberish;
  signer: AccountInterface;
}

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
  player_name: num.BigNumberish;
  to_address: string;
}

export interface ClaimRewardProps extends SystemSigner {
  game_token_id: number;
  game_address: string;
}
