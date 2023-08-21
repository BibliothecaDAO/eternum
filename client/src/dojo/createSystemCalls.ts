import { Components, Schema, Type, setComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Account, Event, num } from 'starknet';
import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "./createClientComponents";
import { getEntityIdFromKeys } from "../utils/utils";

// @note: trying to get a high enough number so that it won't be an existing entity id
// TODO: if you call multiple systems at the same time it might be a problem
const LOW_ENTITY_ID = 9999999999;

interface SystemSigner {
    signer: Account
}

interface BuildLaborProps extends SystemSigner {
    realm_id: num.BigNumberish;
    resource_type: num.BigNumberish;
    labor_units: num.BigNumberish;
    multiplier: num.BigNumberish;
}

interface HarvestLaborProps extends SystemSigner {
    realm_id: num.BigNumberish;  // TODO: this is entity id not realm id
    resource_type: num.BigNumberish;
}

interface MintResourcesProps extends SystemSigner {
    entity_id: num.BigNumberish;
    resource_type: num.BigNumberish;
    amount: num.BigNumberish;
}

interface TakeFungibleOrderProps extends SystemSigner {
    taker_id: num.BigNumberish;
    trade_id: num.BigNumberish;
}

interface ChangeOrderStatusProps extends SystemSigner {
    realm_id: num.BigNumberish;
    trade_id: num.BigNumberish;
    new_status: num.BigNumberish;
}

interface CreateFreeTransportUnitProps extends SystemSigner {
    realm_id: num.BigNumberish;
    quantity: num.BigNumberish;
}

interface CreateCaravanProps extends SystemSigner {
    entity_ids: num.BigNumberish[];
}

interface AttachCaravanProps extends SystemSigner {
    realm_id: num.BigNumberish;
    trade_id: num.BigNumberish;
    caravan_id: num.BigNumberish;
}

interface ClaimFungibleOrderProps extends SystemSigner {
    entity_id: num.BigNumberish;
    trade_id: num.BigNumberish;
}

// Interface definition
interface CreateRealmProps extends SystemSigner {
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

interface MakeFungibleOrderProps extends SystemSigner {
    maker_id: num.BigNumberish;
    maker_entity_types: num.BigNumberish[];
    maker_quantities: num.BigNumberish[];
    taker_entity_types: num.BigNumberish[];
    taker_quantities: num.BigNumberish[];
}


export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls(
    { execute, provider, contractComponents }: SetupNetworkResult,
    { Trade, Status, FungibleEntities, OrderResource }: ClientComponents,
) {
    // Refactor the functions using the interfaces
    const build_labor = async (props: BuildLaborProps) => {
        const { realm_id, resource_type, labor_units, multiplier, signer } = props;
        const tx = await execute(signer, "BuildLabor", [realm_id, resource_type, labor_units, multiplier]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        setComponentsFromEvents(contractComponents, getEvents(receipt));
    }

    const harvest_labor = async (props: HarvestLaborProps) => {
        const { realm_id, resource_type, signer } = props;
        const tx = await execute(signer, "HarvestLabor", [realm_id, resource_type]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});

        setComponentsFromEvents(contractComponents, getEvents(receipt));
    }

    const mint_resources = async (props: MintResourcesProps) => {
        const { entity_id, resource_type, amount, signer } = props;
        const tx = await execute(signer, "MintResources", [entity_id, resource_type, amount]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});

        setComponentsFromEvents(contractComponents, getEvents(receipt));
    }

    const make_fungible_order = async (props: MakeFungibleOrderProps): Promise<num.BigNumberish> => {
        const {
            maker_id, maker_entity_types, maker_quantities,
            taker_entity_types, taker_quantities, signer
        } = props;

        const expires_at = Math.floor(Date.now() / 1000 + 2628000);

        // optimisitc rendering of trade
        const overrideId = uuid();
        const trade_id = getEntityIdFromKeys([BigInt(LOW_ENTITY_ID)]);
        const maker_order_id = getEntityIdFromKeys([BigInt(LOW_ENTITY_ID + 1)]);
        const taker_order_id = getEntityIdFromKeys([BigInt(LOW_ENTITY_ID + 2)]);
        const key = getEntityIdFromKeys([BigInt(LOW_ENTITY_ID + 3)]);

        const numberMakerId = maker_id as Type.Number;

        Trade.addOverride(
            overrideId, {
            entity: trade_id,
            value: { trade_id, maker_id: numberMakerId, taker_id: 0, maker_order_id, taker_order_id, expires_at, claimed_by_maker: false, claimed_by_taker: false, taker_needs_caravan: true },
        });
        Status.addOverride(
            overrideId, {
            entity: trade_id,
            value: { value: 0 }
        }
        );
        FungibleEntities.addOverride(
            overrideId, {
            entity: maker_order_id,
            value: { key, count: maker_quantities.length }
        }
        )
        FungibleEntities.addOverride(
            overrideId, {
            entity: taker_order_id,
            value: { key, count: taker_quantities.length }
        }
        )
        for (let i = 0; i < maker_quantities.length; i++) {
            OrderResource.addOverride(
                overrideId, {
                entity: getEntityIdFromKeys([BigInt(LOW_ENTITY_ID + 1), BigInt(LOW_ENTITY_ID + 3), BigInt(i)]),
                value: {
                    resource_type: maker_entity_types[i] as Type.Number,
                    balance: maker_quantities[i] as Type.Number
                }
            }
            )
        }
        for (let i = 0; i < taker_quantities.length; i++) {
            OrderResource.addOverride(
                overrideId, {
                entity: getEntityIdFromKeys([BigInt(LOW_ENTITY_ID + 2), BigInt(LOW_ENTITY_ID + 3), BigInt(i)]),
                value: {
                    resource_type: taker_entity_types[i] as Type.Number,
                    balance: taker_quantities[i] as Type.Number
                }
            }
            )
        }

        try {
            const tx = await execute(signer, "MakeFungibleOrder", [maker_id, maker_entity_types.length, ...maker_entity_types, maker_quantities.length, ...maker_quantities, 0, taker_entity_types.length, ...taker_entity_types, taker_quantities.length, ...taker_quantities, 1, expires_at]);
            const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
            const events = getEvents(receipt);
            setComponentsFromEvents(contractComponents, events);
            // DISCUSS: trade_id NEEDED to continue to next step
            // DISCUSS: but for optimistic rendering just create a new uuid ? 
            let trade_id = getEntityIdFromEvents(events, "Trade");
            return trade_id;
        } finally {
            Trade.removeOverride(overrideId);
            Status.removeOverride(overrideId);
        }
    }

    const take_fungible_order = async (props: TakeFungibleOrderProps) => {
        const { taker_id, trade_id, signer } = props;
        const tx = await execute(signer, "TakeFungibleOrder", [taker_id, trade_id]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});

        setComponentsFromEvents(contractComponents, getEvents(receipt));
    }

    const change_order_status = async (props: ChangeOrderStatusProps) => {
        const { realm_id, trade_id, new_status, signer } = props;
        const tx = await execute(signer, "ChangeOrderStatus", [realm_id, trade_id, new_status]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const create_free_transport_unit = async (props: CreateFreeTransportUnitProps): Promise<number> => {
        const { realm_id, quantity, signer } = props;

        const tx = await execute(signer, "CreateFreeTransportUnit", [realm_id, quantity]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
        // TODO: use getEntityIdFromEvents
        return parseInt(events[1].data[2])
    }

    const create_caravan = async (props: CreateCaravanProps): Promise<number> => {
        const { entity_ids, signer } = props;
        const tx = await execute(signer, "CreateCaravan", [entity_ids.length, ...entity_ids]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
        // TODO: use getEntityIdFromEvents
        const caravan_id = parseInt(events[2].data[2]);
        return caravan_id;
    }

    const attach_caravan = async (props: AttachCaravanProps) => {
        const { realm_id, trade_id, caravan_id, signer } = props;
        const tx = await execute(signer, "AttachCaravan", [realm_id, trade_id, caravan_id]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const claim_fungible_order = async (props: ClaimFungibleOrderProps) => {
        const { entity_id, trade_id, signer } = props;
        const tx = await execute(signer, "ClaimFungibleOrder", [entity_id, trade_id]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const create_realm = async (props: CreateRealmProps): Promise<number> => {
        const {
            realm_id, owner, resource_types_packed, resource_types_count,
            cities, harbors, rivers, regions, wonder, order, position, signer
        } = props;

        const tx = await execute(signer, "CreateRealm", [
            realm_id, owner, resource_types_packed, resource_types_count,
            cities, harbors, rivers, regions, wonder, order, position.x, position.y
        ]);

        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, {retryInterval: 500});
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);

        let realm_entity_id: number = 0;
        // TODO: use getEntityIdFromEvents
        for (const event of events) {
            // if component change is Realm (hex), take entity_id
            if (event.data[0] === '0x5265616c6d') {
                realm_entity_id = parseInt(event.data[2]);
            }
        }
        return realm_entity_id;
    }
    return {
        build_labor,
        harvest_labor,
        mint_resources,
        make_fungible_order,
        take_fungible_order,
        claim_fungible_order,
        change_order_status,
        create_free_transport_unit,
        create_caravan,
        attach_caravan,
        create_realm,
    };
}

export function getEvents(receipt: any): any[] {
    return receipt.events.filter((event: any) => {
        return event.keys.length === 1 &&
            event.keys[0] === import.meta.env.VITE_EVENT_KEY;
    });
}

export function setComponentsFromEvents(components: Components, events: Event[]) {
    events.forEach((event) => setComponentFromEvent(components, event.data));
}

export function setComponentFromEvent(components: Components, eventData: string[]) {
    // retrieve the component name
    const componentName = hexToAscii(eventData[0]);

    // retrieve the component from name
    const component = components[componentName];

    // get keys
    const keysNumber = parseInt(eventData[1]);
    let index = 2 + keysNumber + 1;

    const keys = eventData.slice(2, 2 + keysNumber).map((key) => BigInt(key));

    // get entityIndex from keys
    const entityIndex = getEntityIdFromKeys(keys);

    // get values
    let numberOfValues = parseInt(eventData[index++]);

    // get values
    const values = eventData.slice(index, index + numberOfValues);

    // create component object from values with schema
    const componentValues = Object.keys(component.schema).reduce((acc: Schema, key, index) => {
        const value = values[index];
        acc[key] = Number(value);
        return acc;
    }, {});

    // set component
    setComponent(component, entityIndex, componentValues);

}

function hexToAscii(hex: string) {
    var str = '';
    for (var n = 2; n < hex.length; n += 2) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
}

function asciiToHex(ascii: string) {
    var hex = '';
    for (var i = 0; i < ascii.length; i++) {
        var charCode = ascii.charCodeAt(i);
        hex += charCode.toString(16).padStart(2, '0');
    }
    return `0x${hex}`;
}

function getEntityIdFromEvents(events: Event[], componentName: string): number {
    let entityId = 0;
    const event = events.find((event) => {
        return event.data[0] === asciiToHex(componentName);
    });
    if (event) {
        entityId = parseInt(event.data[2]);
    }
    return entityId;
}
