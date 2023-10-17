import { Account, num } from "starknet";

interface SystemSigner {
    signer: Account;
}

export interface TravelProps extends SystemSigner {
    travelling_entity_id: num.BigNumberish;
    destination_coord_x: num.BigNumberish;
    destination_coord_y: num.BigNumberish;
}

export interface InitializeHyperstructuresProps extends SystemSigner {
    entity_id: num.BigNumberish;
    hyperstructure_id: num.BigNumberish;
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
}

export interface BuildLaborProps extends SystemSigner {
    realm_id: num.BigNumberish;
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

export interface TakeFungibleOrderProps extends SystemSigner {
    taker_id: num.BigNumberish;
    trade_id: num.BigNumberish;
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

export interface ClaimFungibleOrderProps extends SystemSigner {
    entity_id: num.BigNumberish;
    trade_id: num.BigNumberish;
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
}

export interface MakeFungibleOrderProps extends SystemSigner {
    maker_id: num.BigNumberish;
    maker_entity_types: num.BigNumberish[];
    maker_quantities: num.BigNumberish[];
    taker_id: num.BigNumberish;
    taker_entity_types: num.BigNumberish[];
    taker_quantities: num.BigNumberish[];
}
