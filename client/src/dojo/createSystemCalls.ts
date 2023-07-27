import { EVENT_KEY, SetupNetworkResult } from "./setupNetwork";
import {number} from 'starknet';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls(
    { execute, provider }: SetupNetworkResult,
) {
    // TODO: this is entity id not realm id 
    const build_labor = async ({realm_id, resource_type, labor_units, multiplier}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish, labor_units: number.BigNumberish, multiplier: number.BigNumberish}) => {
        const tx = await execute("BuildLabor", [realm_id, resource_type, labor_units, multiplier]);
    }

    // TODO: this is entity id not realm id 
    const harvest_labor = async ({realm_id, resource_type}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish}) => {
        const tx = await execute("HarvestLabor", [realm_id, resource_type]);
    }

    const mint_resources = async ({entity_id, resource_type, amount}: {entity_id: number.BigNumberish, resource_type: number.BigNumberish, amount: number.BigNumberish}) => {
        const tx = await execute("MintResources", [entity_id, resource_type, amount]);
    }

    const make_fungible_order = async ({maker_id, maker_entity_types, maker_quantities, taker_entity_types, taker_quantities}: {maker_id: number.BigNumberish, maker_entity_types: number.BigNumberish[], maker_quantities: number.BigNumberish[], taker_entity_types: number.BigNumberish[], taker_quantities: number.BigNumberish[]}) => {
        const tx = await execute("MakeFungibleOrder", [maker_id, maker_entity_types.length, ...maker_entity_types, maker_quantities.length, ...maker_quantities, 0, taker_entity_types.length, ...taker_entity_types, taker_quantities.length, ...taker_quantities, 1, Date.now()/1000 + 2628000]);
        const events = await provider.provider.getTransactionReceipt(tx.transaction_hash).then((receipt) => {
            return receipt.events.filter((event) => {
                return event.keys.length === 1 &&
                event.keys[0] === EVENT_KEY;
            })
        })
        let trade_id: number = 0;
        for (const event of events) {
            // if component change is Trade, take entity_id
            if (event.data[0] === '0x5472616465') {
                trade_id = parseInt(event.data[2]);
            }
        }
        return trade_id;
    }

    const take_fungible_order = async({taker_id, trade_id}: {taker_id: number.BigNumberish, trade_id: number.BigNumberish}) => {
        const tx = await execute("TakeFungibleOrder", [taker_id, trade_id]);
    }

    const change_order_status = async({realm_id, trade_id, new_status}: {realm_id: number.BigNumberish, trade_id: number.BigNumberish, new_status: number.BigNumberish}) => {
        const tx = await execute("ChangeOrderStatus", [realm_id, trade_id, new_status]);
    }

    const create_free_transport_unit = async({realm_id, quantity}: {realm_id: number.BigNumberish, quantity: number.BigNumberish}): Promise<number> => {
        const tx = await execute("CreateFreeTransportUnit", [realm_id, quantity]);
        const events = await provider.provider.getTransactionReceipt(tx.transaction_hash).then((receipt) => {
            return receipt.events.filter((event) => {
                return event.keys.length === 1 &&
                event.keys[0] === EVENT_KEY;
            })
        })
        return parseInt(events[1].data[2])
    }

    const create_caravan = async({entity_ids}: {entity_ids: number.BigNumberish[]}): Promise<number> => {
        const tx = await execute("CreateCaravan", [entity_ids.length, ...entity_ids]);
        const events = await provider.provider.getTransactionReceipt(tx.transaction_hash).then((receipt) => {
            return receipt.events.filter((event) => {
                return event.keys.length === 1 &&
                event.keys[0] === EVENT_KEY;
            })
        })
        const caravan_id = parseInt(events[2].data[2]);
        return caravan_id;
    }

    const attach_caravan = async({realm_id, trade_id, caravan_id}: {realm_id: number.BigNumberish, trade_id: number.BigNumberish, caravan_id: number.BigNumberish}) => {
        const tx = await execute("AttachCaravan", [realm_id, trade_id, caravan_id]);
    }

    const claim_fungible_order = async({entity_id, trade_id}: {entity_id: number.BigNumberish, trade_id: number.BigNumberish}) => {
        const tx = await execute("ClaimFungibleOrder", [entity_id, trade_id]);
    }

    const create_realm = async({realm_id, owner, resource_types_packed, resource_types_count, cities, harbors, rivers, regions, wonder, order, position}: {realm_id: number.BigNumberish, owner: number.BigNumberish, resource_types_packed: number.BigNumberish, resource_types_count: number.BigNumberish, cities: number.BigNumberish, harbors: number.BigNumberish, rivers: number.BigNumberish, regions: number.BigNumberish, wonder: number.BigNumberish, order: number.BigNumberish, position: {x: number.BigNumberish, y: number.BigNumberish}}) => {
        const tx = await execute("CreateRealm", [realm_id, owner, resource_types_packed, resource_types_count, cities, harbors, rivers, regions, wonder, order, position.x, position.y]);
        const events = await provider.provider.getTransactionReceipt(tx.transaction_hash).then((receipt) => {
            return receipt.events.filter((event) => {
                return event.keys.length === 1 &&
                event.keys[0] === EVENT_KEY;
            })
        })
        let realm_entity_id: number = 0;
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