import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { number } from 'starknet';
import { RPCProvider, Query } from "@dojoengine/core";
import { Account, ec } from "starknet";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {

    const contractComponents = defineContractComponents(world);

    const provider = new RPCProvider(import.meta.env.VITE_WORLD_ADDRESS!, import.meta.env.VITE_KATANA_URL);

    const signer = new Account(provider.provider, import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!, ec.getKeyPair(import.meta.env.VITE_KATANA_ACCOUNT_1_PRIVATE_KEY!));

    return {
        contractComponents,
        provider,
        signer,
        execute: async (system: string, call_data: number.BigNumberish[]) => provider.execute(signer, system, call_data),
        entity: async (component: string, query: Query) => provider.entity(component, query),
        entities: async (component: string, partition: number) => provider.entities(component, partition),
        world,
    };
}