import { Account, AccountInterface, CairoOption, num } from "starknet";
import { BuildingType } from "../utils";

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
  name: string;
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

export interface CreateRoadProps extends SystemSigner {
  creator_id: num.BigNumberish;
  start_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  end_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  usage_count: num.BigNumberish;
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
  building_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
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

export interface CreateBankProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  owner_fee_scaled: num.BigNumberish;
}

export interface OpenAccountProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  bank_entity_id: num.BigNumberish;
}

export interface ChangeBankOwnerFeeProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  new_swap_fee_unscaled: num.BigNumberish;
}

export interface BuyResourcesProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  amount: num.BigNumberish;
}

export interface SellResourcesProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  amount: num.BigNumberish;
}

export interface AddLiquidityProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  resource_amount: num.BigNumberish;
  lords_amount: num.BigNumberish;
}

export interface RemoveLiquidityProps extends SystemSigner {
  bank_entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  shares: num.BigNumberish;
}

export interface Troops {
  knight_count: num.BigNumberish;
  paladin_count: num.BigNumberish;
  crossbowman_count: num.BigNumberish;
}

export interface CreateArmyProps extends SystemSigner {
  owner_id: num.BigNumberish;
  troops: Troops;
}

export interface StartBattleProps extends SystemSigner {
  attacker_id: num.BigNumberish;
  defender_id: num.BigNumberish;
}

export interface JoinBattleProps extends SystemSigner {
  battle_id: num.BigNumberish;
  battle_side: num.BigNumberish;
  army_id: num.BigNumberish;
}

export interface LeaveBattleProps extends SystemSigner {
  battle_id: num.BigNumberish;
  army_id: num.BigNumberish;
}
