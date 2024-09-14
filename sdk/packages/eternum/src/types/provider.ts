import { Account, AccountInterface, BigNumberish, CairoOption, num } from "starknet";
import { ResourcesIds } from "../constants";
import { BuildingType } from "../constants/structures";

interface SystemSigner {
  signer: AccountInterface | Account;
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

export interface LevelUpRealmProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
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

export interface MintResourcesAndClaimProps extends SystemSigner {
  config_ids: num.BigNumberish[];
  receiver_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

interface Realm {
  realm_id: num.BigNumberish;
  resource_types_packed: num.BigNumberish;
  resource_types_count: num.BigNumberish;
  cities: num.BigNumberish;
  harbors: num.BigNumberish;
  rivers: num.BigNumberish;
  regions: num.BigNumberish;
  wonder: num.BigNumberish;
  order: num.BigNumberish;
  position: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
}

export interface CreateMultipleRealmsProps extends SystemSigner {
  realms: Realm[];
}

export interface CreateRealmProps extends Realm, SystemSigner {}

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
}

export interface CreateAdminBankProps extends SystemSigner {
  coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  owner_fee_num: num.BigNumberish;
  owner_fee_denom: num.BigNumberish;
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
  resource_type: num.BigNumberish;
  resource_amount: num.BigNumberish;
  lords_amount: num.BigNumberish;
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

export interface BattleJoinProps extends SystemSigner {
  battle_id: num.BigNumberish;
  battle_side: num.BigNumberish;
  army_id: num.BigNumberish;
}

export interface BattleLeaveProps extends SystemSigner {
  battle_id: num.BigNumberish;
  army_id: num.BigNumberish;
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
export interface BattleClaimAndLeaveProps extends SystemSigner, BattleClaimAndLeave {}

type BattleLeaveAndRaid = BattlePillageProps & BattleLeaveProps;
export interface BattleLeaveAndRaidProps extends SystemSigner, BattleLeaveAndRaid {}

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

export interface LeaveGuild extends SystemSigner {}

export interface TransferGuildOwnership extends SystemSigner {
  guild_entity_id: num.BigNumberish;
  to_player_address: num.BigNumberish;
}

export interface RemoveGuildMember extends SystemSigner {
  player_address_to_remove: num.BigNumberish;
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

export interface SetMintConfigProps extends SystemSigner {
  config_id: num.BigNumberish;
  resources: ResourceCosts[];
}

export interface SetMapConfigProps extends SystemSigner {
  config_id: num.BigNumberish;
  explore_wheat_burn_amount: num.BigNumberish;
  explore_fish_burn_amount: num.BigNumberish;
  travel_wheat_burn_amount: num.BigNumberish;
  travel_fish_burn_amount: num.BigNumberish;
  reward_amount: num.BigNumberish;
  shards_mines_fail_probability: num.BigNumberish;
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
  battle_grace_tick_count: num.BigNumberish;
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
  battle_leave_slash_num: num.BigNumberish;
  battle_leave_slash_denom: num.BigNumberish;
}

export interface SetBuildingCategoryPopConfigProps extends SystemSigner {
  calls: { building_category: BuildingType; population: num.BigNumberish; capacity: num.BigNumberish }[];
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

export interface SetWorldConfigProps extends SystemSigner {
  admin_address: num.BigNumberish;
  realm_l2_contract: num.BigNumberish;
}

export interface SetSpeedConfigProps extends SystemSigner {
  entity_type: num.BigNumberish;
  sec_per_km: num.BigNumberish;
}

export interface SetHyperstructureConfig extends SystemSigner {
  resources_for_completion: { resource: number; amount: number }[];
  time_between_shares_change: num.BigNumberish;
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
}

export type ProtectStructureProps = Omit<ArmyCreateProps, "is_defensive_army">;

export interface SetMercenariesConfigProps extends SystemSigner {
  troops: Troops;
  rewards: { resource: number; amount: number }[];
}
