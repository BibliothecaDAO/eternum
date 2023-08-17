import { Components, Schema, setComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Event, number } from 'starknet';
import { getEntityIdFromKeys } from "../utils/utils";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls(
    { execute, provider, contractComponents }: SetupNetworkResult,
) {
    // TODO: this is entity id not realm id 
    const build_labor = async ({ realm_id, resource_type, labor_units, multiplier }: { realm_id: number.BigNumberish, resource_type: number.BigNumberish, labor_units: number.BigNumberish, multiplier: number.BigNumberish }) => {
        const tx = await execute("BuildLabor", [realm_id, resource_type, labor_units, multiplier]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    // TODO: this is entity id not realm id 
    const harvest_labor = async ({ realm_id, resource_type }: { realm_id: number.BigNumberish, resource_type: number.BigNumberish }) => {
        const tx = await execute("HarvestLabor", [realm_id, resource_type]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const mint_resources = async ({ entity_id, resource_type, amount }: { entity_id: number.BigNumberish, resource_type: number.BigNumberish, amount: number.BigNumberish }) => {
        const tx = await execute("MintResources", [entity_id, resource_type, amount]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const make_fungible_order = async ({ maker_id, maker_entity_types, maker_quantities, taker_entity_types, taker_quantities }: { maker_id: number.BigNumberish, maker_entity_types: number.BigNumberish[], maker_quantities: number.BigNumberish[], taker_entity_types: number.BigNumberish[], taker_quantities: number.BigNumberish[] }) => {
        const tx = await execute("MakeFungibleOrder", [maker_id, maker_entity_types.length, ...maker_entity_types, maker_quantities.length, ...maker_quantities, 0, taker_entity_types.length, ...taker_entity_types, taker_quantities.length, ...taker_quantities, 1, Date.now() / 1000 + 2628000]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
        // DISCUSS: trade_id NEEDED to continue to next step
        // DISCUSS: but for optimistic rendering just create a new uuid ? 
        let trade_id = getEntityIdFromEvents(events, "Trade");
        return trade_id;
    }

    const take_fungible_order = async ({ taker_id, trade_id }: { taker_id: number.BigNumberish, trade_id: number.BigNumberish }) => {
        const tx = await execute("TakeFungibleOrder", [taker_id, trade_id]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const change_order_status = async ({ realm_id, trade_id, new_status }: { realm_id: number.BigNumberish, trade_id: number.BigNumberish, new_status: number.BigNumberish }) => {
        const tx = await execute("ChangeOrderStatus", [realm_id, trade_id, new_status]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const create_free_transport_unit = async ({ realm_id, quantity }: { realm_id: number.BigNumberish, quantity: number.BigNumberish }): Promise<number> => {
        const tx = await execute("CreateFreeTransportUnit", [realm_id, quantity]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
        // TODO: use getEntityIdFromEvents
        return parseInt(events[1].data[2])
    }

    const create_caravan = async ({ entity_ids }: { entity_ids: number.BigNumberish[] }): Promise<number> => {
        const tx = await execute("CreateCaravan", [entity_ids.length, ...entity_ids]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
        // TODO: use getEntityIdFromEvents
        const caravan_id = parseInt(events[2].data[2]);
        return caravan_id;
    }

    const attach_caravan = async ({ realm_id, trade_id, caravan_id }: { realm_id: number.BigNumberish, trade_id: number.BigNumberish, caravan_id: number.BigNumberish }) => {
        const tx = await execute("AttachCaravan", [realm_id, trade_id, caravan_id]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const claim_fungible_order = async ({ entity_id, trade_id }: { entity_id: number.BigNumberish, trade_id: number.BigNumberish }) => {
        const tx = await execute("ClaimFungibleOrder", [entity_id, trade_id]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
        const events = getEvents(receipt);
        setComponentsFromEvents(contractComponents, events);
    }

    const create_realm = async ({ realm_id, owner, resource_types_packed, resource_types_count, cities, harbors, rivers, regions, wonder, order, position }: { realm_id: number.BigNumberish, owner: number.BigNumberish, resource_types_packed: number.BigNumberish, resource_types_count: number.BigNumberish, cities: number.BigNumberish, harbors: number.BigNumberish, rivers: number.BigNumberish, regions: number.BigNumberish, wonder: number.BigNumberish, order: number.BigNumberish, position: { x: number.BigNumberish, y: number.BigNumberish } }) => {
        const tx = await execute("CreateRealm", [realm_id, owner, resource_types_packed, resource_types_count, cities, harbors, rivers, regions, wonder, order, position.x, position.y]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, 500);
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
