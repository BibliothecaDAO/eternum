import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "./createClientComponents";
import { getEntityIdFromKeys } from "../utils/utils";

export function createOptimisticSystemCalls( 
    { Trade, Status }: ClientComponents
    ) {
    function optimisticAcceptOffer(tradeId: number, takerId: number, systemCall: Function) {
        return async function (this: any, ...args: []) {
            const overrideId = uuid();
            let trade_id = getEntityIdFromKeys([BigInt(tradeId)])
            let taker_id = getEntityIdFromKeys([BigInt(takerId)])
            // change status from open to accepted
            Status.addOverride(
                overrideId, {
                    entity: trade_id,
                    value: {value: 1}
                }
            )
            // change trade taker_id to realm
            Trade.addOverride(
                overrideId, {
                    entity: trade_id,
                    value: {taker_id}
                }
            )
            
            // TODO: remove resources from the realm balance
            try {
                await systemCall.apply(this, args); // Call the original function with its arguments and correct context
            } finally {
                // remove overrides
                Status.removeOverride(overrideId);
                Trade.removeOverride(overrideId);
            }
        };
    }

    function optimisticCancelOffer(tradeId: number, systemCall: Function) {
        return async function (this: any, ...args: []) {
            const overrideId = uuid();
            let trade_id = getEntityIdFromKeys([BigInt(tradeId)])
            // change status from open to accepted
            Status.addOverride(
                overrideId, {
                    entity: trade_id,
                    value: {value: 2}
                }
            ) 
            // TODO: remove resources from the realm balance

            try {
                await systemCall.apply(this, args); // Call the original function with its arguments and correct context
            } finally {
                // remove overrides
                Status.removeOverride(overrideId);
            }
        }
    }

    return {
        optimisticAcceptOffer,
        optimisticCancelOffer
    }
}

