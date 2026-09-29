import { Account, AccountInterface, type BigNumberish } from "starknet";
import { BuildingType } from "../constants/structures";
import type { Resource } from "./common";

export interface NativeTicketIdentity {
  gameId: string;
  actor: string;
  nonce: string;
  order: string;
}

export interface NativeExecutionOutcome extends NativeTicketIdentity {
  nonceConsumed: boolean;
  status: "SUCCEEDED" | "REVERTED";
  statusClass: string;
  reason: string;
  batchRemaining?: string;
}

export interface SystemSigner {
  signer: AccountInterface | Account;
}

export interface ReceiveArmyGrantProps extends SystemSigner {
  village_id: BigNumberish;
}

export interface BridgeDepositIntoRealmProps extends SystemSigner {
  resources: {
    tokenAddress: BigNumberish;
    resource_type: BigNumberish;
    amount: BigNumberish;
  }[];
  recipient_structure_id: BigNumberish;
  client_fee_recipient: BigNumberish;
}

export interface BridgeWithdrawFromRealmProps extends SystemSigner {
  resources: {
    tokenAddress: BigNumberish;
    resource_type: BigNumberish;
    amount: BigNumberish;
  }[];
  from_structure_id: BigNumberish;
  recipient_address: BigNumberish;
  client_fee_recipient: BigNumberish;
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

export interface SendResourcesMultipleProps extends SystemSigner {
  calls: {
    sender_entity_id: BigNumberish;
    recipient_entity_id: BigNumberish;
    resources: BigNumberish[];
  }[];
}

export interface ArrivalsOffloadProps extends SystemSigner {
  structureId: BigNumberish;
  day: BigNumberish;
  slot: BigNumberish;
  resource_count: BigNumberish;
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

export interface RemoveGuildMember extends SystemSigner {
  player_address_to_remove: BigNumberish;
}

export interface DisbandGuild extends SystemSigner {
  calls: { address: BigNumberish }[];
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

export interface InitializeHyperstructureProps extends SystemSigner {
  hyperstructure_id: BigNumberish;
}

export interface ContributeToConstructionProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  contributor_entity_id: BigNumberish;
  contributions: { resource: number; amount: BigNumberish }[];
}

export interface SetAccessProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  access: BigNumberish;
}
export interface EndGameProps extends SystemSigner {}

export interface SetCoOwnersProps extends SystemSigner {
  hyperstructure_entity_id: BigNumberish;
  co_owners: Record<number, BigNumberish>[];
}

/**
 * Props for burning resources to produce labor
 */
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
 * Properties for exploring and receiving the discovery reward
 */
export interface ExplorerExploreProps extends SystemSigner {
  /** ID of the explorer to move */
  explorer_id: number;
  /** Array of directions to move in */
  directions: number[];
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

export interface LeaveGuildProps extends SystemSigner {}

export interface TransferStructureOwnershipProps extends SystemSigner {
  structure_id: BigNumberish;
  new_owner: BigNumberish;
}

export interface StructureBurnProps extends SystemSigner {
  structure_id: BigNumberish;
  resources: Resource[];
}

export interface InteractSiteProps extends SystemSigner {
  explorer_id: BigNumberish;
  coord: { alt: boolean; x: BigNumberish; y: BigNumberish };
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

export interface BitcoinMineContributeLaborProps extends SystemSigner {
  structure_id: BigNumberish;
  labor_amount: BigNumberish;
}

export interface BitcoinMinePhaseProps extends SystemSigner {
  phase_id: BigNumberish;
}

export interface BitcoinMineClaimPhaseRewardProps extends BitcoinMinePhaseProps {
  mine_ids: BigNumberish[];
}
