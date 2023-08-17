import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "./createClientComponents";
import { getEntityIdFromKeys } from "../utils/utils";
import { getComponentValue } from "@latticexyz/recs";

export function createOptimisticSystemCalls( 
    { Trade, Status, Labor }: ClientComponents
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

    function optimisticBuildLabor(realmId: number, resourceId: number, laborUnits: number, multiplier: number, systemCall: Function) {
        return async function (this: any, ...args: []) {
            const overrideId = uuid();
            const labor_id = getEntityIdFromKeys([BigInt(realmId), BigInt(resourceId)]);

            // TODO: put in config file
            let laborConfig = {
                base_food_per_cycle: 14000,
                base_labor_units: 7200,
                base_resources_per_cycle: 21,
              };


            // TODO: remove resources from the realm balance
            
            // compute new values
            let labor = getComponentValue(Labor, labor_id);
            const last_harvest = Math.floor(Date.now()/1000);
            const balance = labor? labor.balance + laborUnits * laborConfig.base_labor_units : laborUnits;
            // change status from open to accepted
            Labor.addOverride(
                overrideId, {
                    entity: labor_id,
                    value: {
                        multiplier,
                        balance,
                        last_harvest
                    }
                }
            )

            try {
                await systemCall.apply(this, args); // Call the original function with its arguments and correct context
            } finally {
                // remove overrides
                Labor.removeOverride(overrideId);
            }
        }
    }

    return {
        optimisticAcceptOffer,
        optimisticCancelOffer,
        optimisticBuildLabor,
    }
}

