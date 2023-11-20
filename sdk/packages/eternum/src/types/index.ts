import { Account, num } from "starknet";

interface SystemSigner {
  signer: Account;
}

export interface CreateSoldiersProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  quantity: num.BigNumberish;
}

export enum Duty {
  ATTACK = 0,
  DEFEND = 1,
}

export interface GroupAndDeploySoldiersProps extends SystemSigner {
  realm_entity_id: num.BigNumberish;
  soldier_ids: num.BigNumberish[];
  duty: Duty;
}

export interface UngroupSoldiersProps extends SystemSigner {
  group_id: num.BigNumberish;
}

export interface UngroupAndRegroupSoldiersProps extends SystemSigner {
  group_id: num.BigNumberish;
  realm_entity_id: num.BigNumberish;
  new_total_quantity: num.BigNumberish;
  // if empty, no new soldier in the group
  new_soldier_ids: num.BigNumberish[];
  duty: Duty;
}

export interface SetAddressNameProps extends SystemSigner {
  name: string;
}

export interface AttackProps extends SystemSigner {
  attacker_ids: num.BigNumberish[];
  target_id: num.BigNumberish;
}

export interface StealProps extends SystemSigner {
  attacker_id: num.BigNumberish;
  target_id: num.BigNumberish;
}

export interface LevelUpProps extends SystemSigner {
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
}

export interface InitializeHyperstructuresProps extends SystemSigner {
  entity_id: num.BigNumberish;
  hyperstructure_id: num.BigNumberish;
}

export interface InitializeHyperstructuresAndTravelProps extends SystemSigner {
  entity_id: num.BigNumberish;
  hyperstructure_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}
export interface FeedHyperstructureAndTravelBackPropos extends SystemSigner {
  entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
  resources: num.BigNumberish[];
  hyperstructure_id: num.BigNumberish;
}

export interface SendResourcesToHyperstructureProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
  donkeys_quantity?: num.BigNumberish;
  caravan_id?: num.BigNumberish;
}

export interface CompleteHyperStructureProps extends SystemSigner {
  hyperstructure_id: num.BigNumberish;
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

export interface MintResourcesProps extends SystemSigner {
  entity_id: num.BigNumberish;
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

// Interface definition
export interface CreateRealmProps extends SystemSigner {
  realm_id: num.BigNumberish;
  owner: num.BigNumberish;
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
  resources: num.BigNumberish[];
}

export interface OffloadResourcesProps extends SystemSigner {
  entity_id: num.BigNumberish;
  entity_index_in_inventory: num.BigNumberish;
  receiving_entity_id: num.BigNumberish;
  transport_id: num.BigNumberish;
}
