import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { num } from 'starknet';
import { RPCProvider, Query } from "@dojoengine/core";
import { Account } from "starknet";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {

    const provider = new RPCProvider(import.meta.env.VITE_WORLD_ADDRESS!, import.meta.env.VITE_KATANA_URL);

    return {
        contractComponents: defineContractComponents(world),
        provider,
        execute: async (signer: Account, system: string, call_data: num.BigNumberish[]) => provider.execute(signer, system, call_data),
        entity: async (component: string, query: Query) => provider.entity(component, query),
        entities: async (component: string, partition: number) => provider.entities(component, partition),
        world,
    };
}