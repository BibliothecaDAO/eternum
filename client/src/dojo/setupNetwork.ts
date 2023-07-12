import { defineContractComponents } from "./contractComponents";
import { world } from "./world";
import { number } from 'starknet';

import { Providers, Query, SyncWorker} from "@dojoengine/core";
import { Account, ec } from "starknet";

export const KATANA_ACCOUNT_1_ADDRESS = "0x03ee9e18edc71a6df30ac3aca2e0b02a198fbce19b7480a63a0d71cbd76652e0"
export const KATANA_ACCOUNT_1_PRIVATEKEY = "0x0300001800000000300000180000000000030000000000003006001800006600"
export const WORLD_ADDRESS = "0x26065106fa319c3981618e7567480a50132f23932226a51c219ffb8e47daa84"
export const EVENT_KEY = "0x1a2f334228cee715f1f0f54053bb6b5eac54fa336e0bc1aacf7516decb0471d"


export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork() {

    const contractComponents = defineContractComponents(world);

    const provider = new Providers.RPCProvider(WORLD_ADDRESS);

    const signer = new Account(provider.sequencerProvider, KATANA_ACCOUNT_1_ADDRESS, ec.getKeyPair(KATANA_ACCOUNT_1_PRIVATEKEY))

    const syncWorker = new SyncWorker(provider, contractComponents, EVENT_KEY);

    return {
        contractComponents,
        provider,
        signer,
        execute: async (system: string, call_data: number.BigNumberish[]) => provider.execute(signer, system, call_data),
        entity: async (component: string, query: Query) => provider.entity(component, query),
        entities: async (component: string, partition: string) => provider.entities(component, partition),
        world,
        syncWorker
    };
}