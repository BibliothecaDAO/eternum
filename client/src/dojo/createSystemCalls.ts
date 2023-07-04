import { SetupNetworkResult } from "./setupNetwork";
import {number} from 'starknet';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls(
    { execute, syncWorker }: SetupNetworkResult,
) {
    const build_labor = async ({realm_id, resource_type, labor_units, multiplier}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish, labor_units: number.BigNumberish, multiplier: number.BigNumberish}) => {
        const tx = await execute("BuildLabor", [realm_id, resource_type, labor_units, multiplier]);
        syncWorker.sync(tx.transaction_hash);
    }

    const harvest_labor = async ({realm_id, resource_type}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish}) => {
        const tx = await execute("HarvestLabor", [realm_id, resource_type]);
        syncWorker.sync(tx.transaction_hash);
    }

    const mint_resources = async ({realm_id, resource_type, amount}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish, amount: number.BigNumberish}) => {
        const tx = await execute("MintResources", [realm_id, resource_type, amount]);
        syncWorker.sync(tx.transaction_hash);
    }

    const make_fungible_order = async ({maker_id, maker_entity_types, maker_quantities, taker_entity_types, taker_quantities}: {maker_id: number.BigNumberish, maker_entity_types: number.BigNumberish[], maker_quantities: number.BigNumberish[], taker_entity_types: number.BigNumberish[], taker_quantities: number.BigNumberish[]}) => {
        const tx = await execute("MakeFungibleOrder", [maker_id, maker_entity_types.length, ...maker_entity_types, maker_quantities.length, ...maker_quantities, 0, taker_entity_types.length, ...taker_entity_types, taker_quantities.length, ...taker_quantities, 1, Date.now()/1000 + 2628000]);
        syncWorker.sync(tx.transaction_hash);
    }

    const create_free_transport_unit = async({realm_id, quantity}: {realm_id: number.BigNumberish, quantity: number.BigNumberish}) => {
        const tx = await execute("CreateFreeTransportUnit", [realm_id, quantity]);
        syncWorker.sync(tx.transaction_hash);
    }

    const create_caravan = async({entity_ids}: {entity_ids: number.BigNumberish[]}) => {
        const tx = await execute("CreateCaravan", [entity_ids.length, ...entity_ids]);
        syncWorker.sync(tx.transaction_hash);
    }

    const attach_caravan = async({realm_id, trade_id, caravan_id}: {realm_id: number.BigNumberish, trade_id: number.BigNumberish, caravan_id: number.BigNumberish}) => {
        const tx = await execute("AttachCaravan", [realm_id, trade_id, caravan_id]);
        syncWorker.sync(tx.transaction_hash);
    }

    return {
        build_labor,
        harvest_labor,
        mint_resources,
        make_fungible_order,
        create_free_transport_unit,
        create_caravan,
        attach_caravan,
    };
}