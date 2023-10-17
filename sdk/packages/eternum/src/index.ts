import { RPCProvider } from "@dojoengine/core";


export class EternumProvider extends RPCProvider {
    constructor(world_address: string, url?: string) {
        super(world_address, url);
    }
}