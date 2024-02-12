import { Account, num } from "starknet";

interface SystemSigner {
  signer: Account;
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

export interface ControlHyperstructureProps extends SystemSigner {
  hyperstructure_id: num.BigNumberish;
  order_id: num.BigNumberish;
}
export interface CompleteHyperstructureProps extends SystemSigner {
  hyperstructure_id: num.BigNumberish;
}

export interface LevelUpRealmProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
}

export interface TravelProps extends SystemSigner {
  travelling_entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}

export interface CreateOrderProps {
  maker_id: num.BigNumberish;
  maker_gives_resource_types: num.BigNumberish[];
  maker_gives_resource_amounts: num.BigNumberish[];
  taker_id: num.BigNumberish;
  taker_gives_resource_types: num.BigNumberish[];
  taker_gives_resource_amounts: num.BigNumberish[];
  signer: any;
  maker_transport_id?: num.BigNumberish;
  donkeys_quantity?: num.BigNumberish;
  expires_at: num.BigNumberish;
}

export interface FeedHyperstructureAndTravelBackPropos extends SystemSigner {
  entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
  resources: num.BigNumberish[];
  inventoryIndex: num.BigNumberish;
  hyperstructure_id: num.BigNumberish;
}

export interface SendResourcesToLocationProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
  donkeys_quantity?: num.BigNumberish;
  caravan_id?: num.BigNumberish;
}

export interface TransferResourcesProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  receiving_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface PurchaseLaborProps extends SystemSigner {
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  labor_units: num.BigNumberish;
  multiplier: num.BigNumberish;
}

export interface ExploreProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  col: num.BigNumberish;
  row: num.BigNumberish;
  direction: num.BigNumberish;
}

export interface BuildLaborProps extends SystemSigner {
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  labor_units: num.BigNumberish;
  multiplier: num.BigNumberish;
}

export interface HarvestLaborProps extends SystemSigner {
  realm_id: num.BigNumberish; // TODO: this is entity id not realm id
  resource_type: num.BigNumberish;
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

export interface HarvestAllLaborProps extends SystemSigner {
  entity_ids: num.BigNumberish[][];
}

export interface MintResourcesProps extends SystemSigner {
  receiver_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface AcceptOrderProps extends SystemSigner {
  taker_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  caravan_id?: num.BigNumberish; // This is optional now
  donkeys_quantity?: num.BigNumberish; // Also optional
}

export interface CancelFungibleOrderProps extends SystemSigner {
  trade_id: num.BigNumberish;
}

export interface CreateFreeTransportUnitProps extends SystemSigner {
  realm_id: num.BigNumberish;
  quantity: num.BigNumberish;
}

export interface CreateCaravanProps extends SystemSigner {
  entity_ids: num.BigNumberish[];
}

export interface DisassembleCaravanAndReturnFreeUnitsProps extends SystemSigner {
  caravan_id: num.BigNumberish;
  unit_ids: num.BigNumberish[];
}

export interface AttachCaravanProps extends SystemSigner {
  realm_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  caravan_id: num.BigNumberish;
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

export interface CreateLaborBuildingProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  building_type: num.BigNumberish;
}

export interface DestroyLaborBuildingProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
}
