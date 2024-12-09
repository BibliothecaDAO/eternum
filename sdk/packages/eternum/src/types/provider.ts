import { Account, AccountInterface, BigNumberish, CairoOption, num } from "starknet";
import { ResourcesIds } from "../constants";
import { BuildingType } from "../constants/structures";

interface SystemSigner {
  signer: AccountInterface | Account;
}

export interface BridgeResourcesIntoRealmProps extends SystemSigner {
  resources: {
    tokenAddress: num.BigNumberish;
    amount: num.BigNumberish;
  }[];
  through_bank_id: num.BigNumberish;
  recipient_realm_entity_id: num.BigNumberish;
  client_fee_recipient: num.BigNumberish;
}

export interface BridgeStartWithdrawFromRealmProps extends SystemSigner {
  through_bank_id: num.BigNumberish;
  from_realm_entity_id: num.BigNumberish;
  token: num.BigNumberish;
  amount: num.BigNumberish;
}

export interface BridgeFinishWithdrawFromRealmProps extends SystemSigner {
  through_bank_id: num.BigNumberish;
  from_entity_id: num.BigNumberish;
  token: num.BigNumberish;
  recipient_address: num.BigNumberish;
  client_fee_recipient: num.BigNumberish;
}
export interface CreateSoldiersProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  quantity: num.BigNumberish;
}

export interface HealSoldiersProps extends SystemSigner {
  unit_id: num.BigNumberish;
  health_amount: num.BigNumberish;
}

export interface DetachSoldiersProps extends SystemSigner {
  unit_id: num.BigNumberish;
  detached_quantity: num.BigNumberish;
}

export interface SetAddressNameProps extends SystemSigner {
  name: num.BigNumberish;
}

export interface SetEntityNameProps extends SystemSigner {
  entity_id: num.BigNumberish;
  name: string;
}

export interface AttackProps extends SystemSigner {
  attacker_ids: num.BigNumberish[];
  target_id: num.BigNumberish;
}

export interface MergeSoldiersProps extends SystemSigner {
  merge_into_unit_id: num.BigNumberish;
  units: num.BigNumberish[];
}

export interface CreateAndMergeSoldiersProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  quantity: num.BigNumberish;
  merge_into_unit_id: num.BigNumberish;
}

export interface StealProps extends SystemSigner {
  attacker_id: num.BigNumberish;
  target_id: num.BigNumberish;
}

export interface TravelProps extends SystemSigner {
  travelling_entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}

export interface TravelHexProps extends SystemSigner {
  travelling_entity_id: num.BigNumberish;
  directions: num.BigNumberish[];
}

export interface CreateOrderProps extends SystemSigner {
  maker_id: num.BigNumberish;
  maker_gives_resources: num.BigNumberish[];
  taker_id: num.BigNumberish;
  taker_gives_resources: num.BigNumberish[];
  expires_at: num.BigNumberish;
}

export interface AcceptOrderProps extends SystemSigner {
  taker_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  maker_gives_resources: num.BigNumberish[];
  taker_gives_resources: num.BigNumberish[];
}

export interface AcceptPartialOrderProps extends SystemSigner {
  taker_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  maker_gives_resources: num.BigNumberish[];
  taker_gives_resources: num.BigNumberish[];
  taker_gives_actual_amount: num.BigNumberish;
}

export interface CancelOrderProps extends SystemSigner {
  trade_id: num.BigNumberish;
  return_resources: num.BigNumberish[];
}

export interface SendResourcesProps extends SystemSigner {
  sender_entity_id: num.BigNumberish;
  recipient_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
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
  resources: num.BigNumberish[];
}

export interface TransferResourcesProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  receiving_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface ExploreProps extends SystemSigner {
  unit_id: num.BigNumberish;
  direction: num.BigNumberish;
}

export interface SwapBankAndTravelBackProps extends SystemSigner {
  sender_id: num.BigNumberish;
  inventoryIndex: num.BigNumberish;
  bank_id: num.BigNumberish;
  indices: num.BigNumberish[];
  resource_types: num.BigNumberish[];
  resource_amounts: num.BigNumberish[];
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}

export interface MintResourcesProps extends SystemSigner {
  receiver_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface ClaimQuestProps extends SystemSigner {
  quest_ids: num.BigNumberish[];
  receiver_id: num.BigNumberish;
}

export interface CreateMultipleRealmsProps extends SystemSigner {
  owner: num.BigNumberish;
  realm_ids: num.BigNumberish[];
  frontend: num.BigNumberish;
  season_pass_address: string;
}

export interface CreateMultipleRealmsDevProps extends SystemSigner {
  realm_ids: num.BigNumberish[];
}
export interface CreateRealmDevProps extends SystemSigner {
  realm_id: num.BigNumberish;
}
export interface CreateRealmProps extends SystemSigner {
  owner: num.BigNumberish;
  realm_id: num.BigNumberish;
  frontend: num.BigNumberish;
}

export interface UpgradeRealmProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
}

export interface TransferItemsProps extends SystemSigner {
  sender_id: num.BigNumberish;
  indices: num.BigNumberish[];
  receiver_id: num.BigNumberish;
}

export interface TransferItemsFromMultipleProps extends SystemSigner {
  senders: {
    sender_id: num.BigNumberish;
    indices: num.BigNumberish[];
    receiver_id: num.BigNumberish;
  }[];
}

export interface CreateBuildingProps extends SystemSigner {
  entity_id: num.BigNumberish;
  directions: num.BigNumberish[];
  building_category: BuildingType;
  produce_resource_type: CairoOption<Number>;
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

export interface CreateBankProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  owner_fee_num: num.BigNumberish;
  owner_fee_denom: num.BigNumberish;
  owner_bridge_fee_dpt_percent: num.BigNumberish;
  owner_bridge_fee_wtdr_percent: num.BigNumberish;
}

export interface CreateAdminBankProps extends SystemSigner {
  name: string;
  coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  owner_fee_num: num.BigNumberish;
  owner_fee_denom: num.BigNumberish;
  owner_bridge_fee_dpt_percent: num.BigNumberish;
  owner_bridge_fee_wtdr_percent: num.BigNumberish;
}

export interface OpenAccountProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  bank_entity_id: num.BigNumberish;
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

export interface Troops {
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
  troops: Troops;
}

export interface ArmyMergeTroopsProps extends SystemSigner {
  from_army_id: num.BigNumberish;
  to_army_id: num.BigNumberish;
  troops: Troops;
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
export interface WhitelistPlayerProps extends SystemSigner {
  player_address_to_whitelist: num.BigNumberish;
  guild_entity_id: num.BigNumberish;
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

export interface SetQuestConfigProps extends SystemSigner {
  production_material_multiplier: num.BigNumberish;
}

export interface SetQuestRewardConfigProps extends SystemSigner {
  calls: {
    quest_id: num.BigNumberish;
    resources: ResourceCosts[];
  }[];
}

export interface SetMapConfigProps extends SystemSigner {
  config_id: num.BigNumberish;
  reward_amount: num.BigNumberish;
  shards_mines_fail_probability: num.BigNumberish;
}

export interface SetTravelStaminaCostConfigProps extends SystemSigner {
  travel_type: num.BigNumberish;
  cost: num.BigNumberish;
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
  category: num.BigNumberish;
  weight_gram: num.BigNumberish;
}

export interface SetWeightConfigProps extends SystemSigner {
  calls: {
    entity_type: num.BigNumberish;
    weight_gram: num.BigNumberish;
  }[];
}

export interface SetTickConfigProps extends SystemSigner {
  tick_id: num.BigNumberish;
  tick_interval_in_seconds: num.BigNumberish;
}

export interface SetProductionConfigProps extends SystemSigner {
  calls: {
    resource_type: num.BigNumberish;
    amount: num.BigNumberish;
    cost: ResourceCosts[];
  }[];
}

export interface SetBankConfigProps extends SystemSigner {
  lords_cost: num.BigNumberish;
  lp_fee_num: num.BigNumberish;
  lp_fee_denom: num.BigNumberish;
}

export interface SetBattleConfigProps extends SystemSigner {
  config_id: num.BigNumberish;
  regular_immunity_ticks: num.BigNumberish;
  hyperstructure_immunity_ticks: num.BigNumberish;
  battle_delay_seconds: num.BigNumberish;
}
export interface SetTroopConfigProps extends SystemSigner {
  config_id: num.BigNumberish;
  health: num.BigNumberish;
  knight_strength: num.BigNumberish;
  paladin_strength: num.BigNumberish;
  crossbowman_strength: num.BigNumberish;
  advantage_percent: num.BigNumberish;
  disadvantage_percent: num.BigNumberish;
  max_troop_count: num.BigNumberish;
  pillage_health_divisor: num.BigNumberish;
  army_free_per_structure: num.BigNumberish;
  army_extra_per_military_building: num.BigNumberish;
  army_max_per_structure: num.BigNumberish;
  battle_leave_slash_num: num.BigNumberish;
  battle_leave_slash_denom: num.BigNumberish;
  battle_time_scale: num.BigNumberish;
  battle_max_time_seconds: num.BigNumberish;
}

export interface SetBuildingCategoryPopConfigProps extends SystemSigner {
  calls: { building_category: BuildingType; population: num.BigNumberish; capacity: num.BigNumberish }[];
}

export interface SetBuildingGeneralConfigProps extends SystemSigner {
  base_cost_percent_increase: num.BigNumberish;
}

export interface SetPopulationConfigProps extends SystemSigner {
  base_population: num.BigNumberish;
}

export interface SetBuildingConfigProps extends SystemSigner {
  calls: {
    building_category: BuildingType;
    building_resource_type: ResourcesIds;
    cost_of_building: ResourceCosts[];
  }[];
}

export interface setRealmUpgradeConfigProps extends SystemSigner {
  calls: {
    level: num.BigNumberish;
    cost_of_level: ResourceCosts[];
  }[];
}

export interface SetRealmMaxLevelConfigProps extends SystemSigner {
  new_max_level: num.BigNumberish;
}

export interface SetWorldConfigProps extends SystemSigner {
  admin_address: num.BigNumberish;
  realm_l2_contract: num.BigNumberish;
}

export interface SetSpeedConfigProps extends SystemSigner {
  entity_type: num.BigNumberish;
  sec_per_km: num.BigNumberish;
}

export interface SetSeasonConfigProps extends SystemSigner {
  season_pass_address: num.BigNumberish;
  realms_address: num.BigNumberish;
  lords_address: num.BigNumberish;
  start_at: num.BigNumberish;
}

export interface SetVRFConfigProps extends SystemSigner {
  vrf_provider_address: num.BigNumberish;
}

export interface SetSeasonBridgeConfigProps extends SystemSigner {
  close_after_end_seconds: num.BigNumberish;
}

export interface SetResourceBridgeWhitelistConfigProps extends SystemSigner {
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
  max_bank_fee_dpt_percent: num.BigNumberish;
  max_bank_fee_wtdr_percent: num.BigNumberish;
}

export interface SetHyperstructureConfig extends SystemSigner {
  resources_for_completion: {
    resource_tier: number;
    min_amount: number;
    max_amount: number;
  }[];
  time_between_shares_change: num.BigNumberish;
  points_per_cycle: num.BigNumberish;
  points_for_win: num.BigNumberish;
  points_on_completion: num.BigNumberish;
}

export interface CreateHyperstructureProps extends SystemSigner {
  creator_entity_id: num.BigNumberish;
  coords: { x: num.BigNumberish; y: num.BigNumberish };
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

export interface EndGameProps extends SystemSigner {
  hyperstructure_contributed_to: number[];
  hyperstructure_shareholder_epochs: { hyperstructure_entity_id: number; epoch: number }[];
}

export interface RegisterToLeaderboardProps extends SystemSigner {
  hyperstructure_contributed_to: number[];
  hyperstructure_shareholder_epochs: { hyperstructure_entity_id: number; epoch: number }[];
}

export interface ClaimLeaderboardRewardsProps extends SystemSigner {
  token: num.BigNumberish;
}

export interface SetCoOwnersProps extends SystemSigner {
  hyperstructure_entity_id: num.BigNumberish;
  co_owners: Record<number, BigNumberish>[];
}

export interface SetStaminaConfigProps extends SystemSigner {
  unit_type: num.BigNumberish;
  max_stamina: num.BigNumberish;
}

export interface SetStaminaRefillConfigProps extends SystemSigner {
  amount_per_tick: num.BigNumberish;
  start_boost_tick_count: num.BigNumberish;
}

export type ProtectStructureProps = Omit<ArmyCreateProps, "is_defensive_army">;

export interface SetMercenariesConfigProps extends SystemSigner {
  knights_lower_bound: num.BigNumberish;
  knights_upper_bound: num.BigNumberish;
  paladins_lower_bound: num.BigNumberish;
  paladins_upper_bound: num.BigNumberish;
  crossbowmen_lower_bound: num.BigNumberish;
  crossbowmen_upper_bound: num.BigNumberish;
  rewards: { resource: number; amount: number }[];
}

export interface SetSettlementConfigProps extends SystemSigner {
  center: num.BigNumberish;
  base_distance: num.BigNumberish;
  min_first_layer_distance: num.BigNumberish;
  points_placed: num.BigNumberish;
  current_layer: num.BigNumberish;
  current_side: num.BigNumberish;
  current_point_on_side: num.BigNumberish;
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
