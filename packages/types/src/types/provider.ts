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
}

export interface ReceiveArmyGrantProps extends SystemSigner {
  village_id: BigNumberish;
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

export interface SpireMakeSpiresProps extends SystemSigner {
  count: number;
  spiresSettledCount: number;
}

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

export interface ProductionPlanInstruction {
  resource_id: BigNumberish;
  cycles: BigNumberish;
}

export interface ExecuteRealmProductionPlanProps extends SystemSigner {
  realm_entity_id: BigNumberish;
  resource_to_resource?: ProductionPlanInstruction[];
  labor_to_resource?: ProductionPlanInstruction[];
  skipQueue?: boolean;
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
    alt: boolean;
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface PauseProductionProps extends SystemSigner {
  entity_id: BigNumberish;
  building_coord: {
    alt: boolean;
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface ResumeProductionProps extends SystemSigner {
  entity_id: BigNumberish;
  building_coord: {
    alt: boolean;
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface ChangeBankOwnerFeeProps extends SystemSigner {
  bank_entity_id: BigNumberish;
  new_swap_fee_num: BigNumberish;
  new_swap_fee_denom: BigNumberish;
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

export interface PledgeFaithProps extends SystemSigner {
  structure_id: BigNumberish;
  wonder_id: BigNumberish;
}

export interface RemoveFaithProps extends SystemSigner {
  structure_id: BigNumberish;
}

export interface UpdateWonderOwnershipProps extends SystemSigner {
  wonder_id: BigNumberish;
}

export interface UpdateStructureOwnershipProps extends SystemSigner {
  structure_id: BigNumberish;
}

interface ResourceCosts {
  resource: ResourcesIds;
  amount: BigNumberish;
}

export interface TroopStaminaConfigProps {
  stamina_gain_per_tick: BigNumberish;
  stamina_initial: BigNumberish;
  stamina_bonus_value: BigNumberish;
  stamina_knight_max: BigNumberish;
  stamina_paladin_max: BigNumberish;
  stamina_crossbowman_max: BigNumberish;
  stamina_attack_req: BigNumberish;
  stamina_defense_req: BigNumberish;
  stamina_explore_wheat_cost: BigNumberish;
  stamina_explore_fish_cost: BigNumberish;
  stamina_explore_stamina_cost: BigNumberish;
  stamina_travel_wheat_cost: BigNumberish;
  stamina_travel_fish_cost: BigNumberish;
  stamina_travel_stamina_cost: BigNumberish;
}

export interface TroopLimitConfigProps {
  guard_resurrection_delay: BigNumberish;
  mercenaries_troop_lower_bound: BigNumberish;
  mercenaries_troop_upper_bound: BigNumberish;
  agent_troop_lower_bound: BigNumberish;
  agent_troop_upper_bound: BigNumberish;
  settlement_deployment_cap: BigNumberish;
  city_deployment_cap: BigNumberish;
  kingdom_deployment_cap: BigNumberish;
  empire_deployment_cap: BigNumberish;
  t1_tier_strength: BigNumberish;
  t2_tier_strength: BigNumberish;
  t3_tier_strength: BigNumberish;
  t1_tier_modifier: BigNumberish;
  t2_tier_modifier: BigNumberish;
  t3_tier_modifier: BigNumberish;
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

export interface BiomeClimateConfigProps {
  elevation_scale_bps: BigNumberish;
  moisture_scale_bps: BigNumberish;
  elevation_bias_bps: BigNumberish;
  moisture_bias_bps: BigNumberish;
  elevation_seed: BigNumberish;
  moisture_seed: BigNumberish;
}

export interface ResourceWhitelistConfig {
  token: BigNumberish;
  resource_type: BigNumberish;
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

export interface SetCoOwnersProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  co_owners: Record<number, BigNumberish>[];
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
  /** Optional VRF source salt (packed tile seed) required when explore=true and VRF is enabled */
  vrf_source_salt?: BigNumberish;
}

/**
 * Properties for traveling an explorer (no exploration)
 */
export interface ExplorerTravelProps extends SystemSigner {
  /** ID of the explorer to move */
  explorer_id: number;
  /** Array of directions to move in */
  directions: number[];
}

/**
 * Properties for toggling explorer layer through a spire
 */
export interface ToggleAlternateProps extends SystemSigner {
  /** ID of the explorer to move */
  explorer_id: number;
  /** Direction from explorer to adjacent spire */
  spire_direction: number;
}

/**
 * Properties for exploring with an explorer (includes VRF and reward extraction)
 */
export interface ExplorerExploreProps extends SystemSigner {
  /** ID of the explorer to move */
  explorer_id: number;
  /** Array of directions to move in */
  directions: number[];
  /** VRF source salt (packed tile seed for the destination tile) */
  vrf_source_salt?: BigNumberish;
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
}

/**
 * Properties for an explorer vs guard attack that garrisons surviving troops into the captured structure
 */
export interface AttackExplorerVsGuardAndGarrisonProps extends SystemSigner {
  /** ID of the attacking explorer */
  explorer_id: number;
  /** ID of the structure with defending guard */
  structure_id: number;
  /** Direction to the structure */
  structure_direction: number;
  /** Guard slot to place surviving troops in once the structure is captured */
  to_guard_slot: number;
  /** Number of surviving troops to garrison (raw count, divisible by resource precision) */
  count: number;
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

export interface OpenLootChestProps {
  signer: AccountInterface;
  token_id: bigint;
  loot_chest_address: string;
  claim_address: string;
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
    alt: boolean;
    x: BigNumberish;
    y: BigNumberish;
  };
}

export interface BurnResearchForRelicProps extends SystemSigner {
  structure_id: BigNumberish;
}

export interface ApplyRelicProps extends SystemSigner {
  entity_id: BigNumberish;
  relic_resource_id: BigNumberish;
  recipient_type: BigNumberish;
}
