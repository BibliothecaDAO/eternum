import { RPCProvider } from "@dojoengine/core";
import { Contracts } from "./constants"
import { PurchaseLaborProps } from "./types";

export class EternumProvider extends RPCProvider {
    constructor(world_address: string, url?: string) {
        super(world_address, url);
    }

    public async purchase_labor(props: PurchaseLaborProps): Promise<any> {
        const { signer, entity_id, resource_type, labor_units } = props;

        const tx = await this.execute(signer, {
            contractAddress: Contracts.LABOR_SYSTEMS,
            calldata: {
                world: this.getWorldAddress(),
                entity_id,
                resource_type,
                labor_units,
            },
            entrypoint: "purchase",
        });

        return await this.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    }
}