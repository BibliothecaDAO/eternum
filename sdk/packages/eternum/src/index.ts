import { RPCProvider } from "@dojoengine/core";
import { Contracts } from "./constants"
import { Account } from "starknet";


export class EternumProvider extends RPCProvider {
    constructor(world_address: string, url?: string) {
        super(world_address, url);
    }

    // fn that console logs
    public async purchase_labor(signer: Account, message: string): Promise<void> {
        const tx = await this.execute(signer, Contracts.LABOR_SYSTEMS, "purchase", [
            import.meta.env.VITE_WORLD_ADDRESS!,
            entity_id,
            resource_type,
            labor_units,
        ]);
        const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    }
}