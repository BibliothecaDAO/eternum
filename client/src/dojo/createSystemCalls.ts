import { SetupNetworkResult } from "./setupNetwork";
import {number} from 'starknet';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls(
    { execute, syncWorker }: SetupNetworkResult,
) {
    const build_labor = async ({realm_id, resource_type, labor_units, multiplier}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish, labor_units: number.BigNumberish, multiplier: number.BigNumberish}) => {
        const tx = await execute("BuildLabor", [realm_id, resource_type, labor_units, multiplier]);
        // await awaitStreamValue(txReduced$, (txHash) => txHash === tx.transaction_hash);
        syncWorker.sync(tx.transaction_hash);
    }

    const harvest_labor = async ({realm_id, resource_type}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish}) => {
        const tx = await execute("HarvestLabor", [realm_id, resource_type]);
        // await awaitStreamValue(txReduced$, (txHash) => txHash === tx.transaction_hash);
        syncWorker.sync(tx.transaction_hash);
    }

    const mint_resources = async ({realm_id, resource_type, amount}: {realm_id: number.BigNumberish, resource_type: number.BigNumberish, amount: number.BigNumberish}) => {
        const tx = await execute("MintResources", [realm_id, resource_type, amount]);
        // get the events from the tx
        // await awaitStreamValue(txReduced$, (txHash) => txHash === tx.transaction_hash);
        syncWorker.sync(tx.transaction_hash);
    }

    return {
        build_labor,
        harvest_labor,
        mint_resources,
    };
}