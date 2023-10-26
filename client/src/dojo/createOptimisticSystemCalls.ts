import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "./createClientComponents";
import { getEntityIdFromKeys } from "../utils/utils";
import { Type, getComponentValue } from "@latticexyz/recs";
import { Resource } from "../types";
import { LaborCostInterface } from "../hooks/helpers/useLabor";
import { LABOR_CONFIG } from "@bibliothecadao/eternum";
import {
  CancelFungibleOrderProps,
  ClaimFungibleOrderProps,
  CreateOrderProps,
  CreateRoadProps,
  HarvestLaborProps,
  PurchaseLaborProps,
  BuildLaborProps
} from "@bibliothecadao/eternum";

export const HIGH_ENTITY_ID = 9999999999;

export function createOptimisticSystemCalls({
  Trade,
  Status,
  Labor,
  Resource,
  FungibleEntities,
  OrderResource,
  Road,
}: ClientComponents) {
  function optimisticCreateOrder(systemCall: (args: any) => Promise<any>) {
    return async function (this: any, args: CreateOrderProps): Promise<void | number> {
      const { maker_id, maker_entity_types, maker_quantities, taker_id, taker_entity_types, taker_quantities } = args;

      const expires_at = Math.floor(Date.now() / 1000 + 2628000);

      // optimisitc rendering of trade
      const overrideId = uuid();
      const trade_id = getEntityIdFromKeys([BigInt(HIGH_ENTITY_ID)]);
      const maker_order_id = getEntityIdFromKeys([BigInt(HIGH_ENTITY_ID + 1)]);
      const taker_order_id = getEntityIdFromKeys([BigInt(HIGH_ENTITY_ID + 2)]);
      const key = getEntityIdFromKeys([BigInt(HIGH_ENTITY_ID + 3)]);

      const numberMakerId = maker_id as Type.Number;
      const numberTakerId = taker_id as Type.Number;

      Trade.addOverride(overrideId, {
        entity: trade_id,
        value: {
          maker_id: numberMakerId,
          taker_id: numberTakerId,
          maker_order_id,
          taker_order_id,
          expires_at,
          claimed_by_maker: false,
          claimed_by_taker: false,
          taker_needs_caravan: true,
        },
      });
      Status.addOverride(overrideId, {
        entity: trade_id,
        value: { value: 0 },
      });
      FungibleEntities.addOverride(overrideId, {
        entity: maker_order_id,
        value: { key, count: maker_quantities.length },
      });
      FungibleEntities.addOverride(overrideId, {
        entity: taker_order_id,
        value: { key, count: taker_quantities.length },
      });
      for (let i = 0; i < maker_quantities.length; i++) {
        OrderResource.addOverride(overrideId, {
          entity: getEntityIdFromKeys([BigInt(HIGH_ENTITY_ID + 1), BigInt(HIGH_ENTITY_ID + 3), BigInt(i)]),
          value: {
            resource_type: maker_entity_types[i] as Type.Number,
            balance: maker_quantities[i] as Type.Number,
          },
        });
      }
      for (let i = 0; i < taker_quantities.length; i++) {
        OrderResource.addOverride(overrideId, {
          entity: getEntityIdFromKeys([BigInt(HIGH_ENTITY_ID + 2), BigInt(HIGH_ENTITY_ID + 3), BigInt(i)]),
          value: {
            resource_type: taker_entity_types[i] as Type.Number,
            balance: taker_quantities[i] as Type.Number,
          },
        });
      }

      try {
        return systemCall(args);
      } finally {
        Trade.removeOverride(overrideId);
        Status.removeOverride(overrideId);
      }
    };
  }

  function optimisticClaimFungibleOrder(
    resourcesGet: Resource[],
    systemCall: (args: ClaimFungibleOrderProps) => Promise<void>,
  ) {
    return async function (this: any, args: ClaimFungibleOrderProps) {
      const { entity_id: realmEntityId, trade_id: tradeId } = args;

      let overrideId = uuid();

      // change trade to claimed by taker or maker
      let trade_id = getEntityIdFromKeys([BigInt(tradeId)]);
      let trade = getComponentValue(Trade, trade_id);
      let isMaker = trade?.maker_id === realmEntityId;

      // set claimed
      if (isMaker) {
        Trade.addOverride(overrideId, {
          entity: trade_id,
          value: {
            claimed_by_maker: true,
          },
        });
      } else {
        Trade.addOverride(overrideId, {
          entity: trade_id,
          value: {
            claimed_by_taker: true,
          },
        });
      }

      // add resources to balance
      for (let resource of resourcesGet) {
        let resource_id = getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resource.resourceId)]);
        let currentResource = getComponentValue(Resource, resource_id) || {
          balance: 0,
        };
        let balance = currentResource.balance + resource.amount;
        Resource.addOverride(overrideId + resource.resourceId, {
          entity: resource_id,
          value: {
            balance,
          },
        });
      }

      try {
        await systemCall(args);
      } finally {
        Trade.removeOverride(overrideId);
        for (let resource of resourcesGet) {
          Resource.removeOverride(overrideId + resource.resourceId);
        }
      }
    };
  }

  function optimisticAcceptOffer(tradeId: number, takerId: number, systemCall: () => Promise<void>) {
    return async function (this: any) {
      const overrideId = uuid();
      let trade_id = getEntityIdFromKeys([BigInt(tradeId)]);
      let taker_id = getEntityIdFromKeys([BigInt(takerId)]);
      // change status from open to accepted
      Status.addOverride(overrideId, {
        entity: trade_id,
        value: { value: 1 },
      });
      // change trade taker_id to realm
      Trade.addOverride(overrideId, {
        entity: trade_id,
        value: { taker_id },
      });

      // TODO: remove resources from the realm balance

      try {
        await systemCall(); // Call the original function with its arguments and correct context
      } finally {
        // remove overrides
        Status.removeOverride(overrideId);
        Trade.removeOverride(overrideId);
      }
    };
  }

  function optimisticCancelOffer(systemCall: (args: CancelFungibleOrderProps) => Promise<void>) {
    return async function (this: any, args: CancelFungibleOrderProps) {
      const { trade_id: tradeId } = args;

      const overrideId = uuid();
      let trade_id = getEntityIdFromKeys([BigInt(tradeId)]);
      // change status from open to accepted
      Status.addOverride(overrideId, {
        entity: trade_id,
        value: { value: 2 },
      });

      try {
        await systemCall(args); // Call the original function with its arguments and correct context
      } finally {
        // remove overrides
        Status.removeOverride(overrideId);
      }
    };
  }

  function optimisticBuildLabor(
    ts: number,
    costResources: LaborCostInterface[],
    laborAuctionAverageCoefficient: number,
    systemCall: (args: PurchaseLaborProps & BuildLaborProps) => Promise<void>,
  ) {
    return async function (this: any, args: PurchaseLaborProps & BuildLaborProps) {
      const { entity_id: realmEntityId, resource_type: resourceId, labor_units: laborUnits, multiplier } = args;

      const overrideId = uuid();
      const resource_id = getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]);

      for (let i = 0; i < costResources.length; i++) {
        let costId = getEntityIdFromKeys([BigInt(realmEntityId), BigInt(costResources[i].resourceId)]);
        let currentResource = getComponentValue(Resource, costId) || {
          balance: 0,
        };
        let balance =
          currentResource.balance -
          (laborUnits as number) * (multiplier as number) * costResources[i].amount * laborAuctionAverageCoefficient;
        Resource.addOverride(overrideId, {
          entity: costId,
          value: {
            balance,
          },
        });
      }

      // compute new values
      let labor = getComponentValue(Labor, resource_id) || {
        balance: ts,
        last_harvest: ts,
        multiplier: 1,
      };

      let additional_labor = (laborUnits as number) * LABOR_CONFIG.base_labor_units;
      let new_balance: number = labor.balance;
      let new_last_harvest: number = labor.last_harvest;
      if (labor.balance <= ts) {
        new_last_harvest += ts - labor.balance;
        new_balance = ts + additional_labor;
      } else {
        new_balance += additional_labor;
      }

      Labor.addOverride(overrideId, {
        entity: resource_id,
        value: {
          multiplier: multiplier as number,
          balance: new_balance,
          last_harvest: new_last_harvest,
        },
      });

      try {
        await systemCall(args); // Call the original function with its arguments and correct context
      } finally {
        // remove overrides
        Labor.removeOverride(overrideId);
        // remove resource overrides
        Resource.removeOverride(overrideId);
      }
    };
  }

  function optimisticHarvestLabor(ts: number, systemCall: (args: HarvestLaborProps) => Promise<void>) {
    return async function (this: any, args: HarvestLaborProps) {
      const { realm_id, resource_type } = args;

      const overrideId = uuid();
      const resource_id = getEntityIdFromKeys([BigInt(realm_id), BigInt(resource_type)]);

      // compute new values
      let labor = getComponentValue(Labor, resource_id) || {
        balance: ts,
        last_harvest: ts,
        multiplier: 1,
      };
      let laborGenerated = labor.balance <= ts ? labor.balance - labor.last_harvest : ts - labor.last_harvest;
      let laborUnharvested = labor.balance <= ts ? 0 : labor.balance - ts;
      let laborUnitsGenerated = Math.floor(laborGenerated / LABOR_CONFIG.base_labor_units);
      let remainder = laborGenerated - laborUnitsGenerated * LABOR_CONFIG.base_labor_units;
      const balance = ts + remainder + laborUnharvested;
      const isFood = resource_type === 255 || resource_type === 254 ? true : false;

      Labor.addOverride(overrideId, {
        entity: resource_id,
        value: {
          multiplier: labor.multiplier,
          balance,
          last_harvest: ts,
        },
      });

      let currentResource = getComponentValue(Resource, resource_id) || {
        balance: 0,
      };
      let resourceBalance = isFood
        ? laborUnitsGenerated * LABOR_CONFIG.base_food_per_cycle * labor.multiplier
        : laborUnitsGenerated * LABOR_CONFIG.base_resources_per_cycle;
      Resource.addOverride(overrideId, {
        entity: resource_id,
        value: {
          balance: resourceBalance + currentResource.balance,
        },
      });

      try {
        await systemCall(args); // Call the original function with its arguments and correct context
      } finally {
        // remove overrides
        Labor.removeOverride(overrideId);
        Resource.removeOverride(overrideId);
      }
    };
  }

  function optimisticBuildRoad(systemCall: (args: CreateRoadProps) => Promise<void>) {
    return async function (this: any, args: CreateRoadProps) {
      const { creator_id, start_coord, end_coord, usage_count } = args;
      const overrideId = uuid();
      // change status from open to accepted
      let usageCount = usage_count as Type.Number;
      Road.addOverride(overrideId, {
        entity: getEntityIdFromKeys([
          BigInt(start_coord.x),
          BigInt(start_coord.y),
          BigInt(end_coord.x),
          BigInt(end_coord.y),
        ]),
        value: { usage_count: usageCount },
      });

      let { balance } = getComponentValue(Resource, getEntityIdFromKeys([BigInt(creator_id), BigInt(2)])) || {
        balance: 0,
      };

      // change trade taker_id to realm
      Resource.addOverride(overrideId, {
        entity: getEntityIdFromKeys([BigInt(creator_id), BigInt(2)]),
        value: {
          // 10 stone per usage
          balance: balance - usageCount * 10,
        },
      });

      try {
        await systemCall(args); // Call the original function with its arguments and correct context
      } finally {
        // remove overrides
        Road.removeOverride(overrideId);
        Resource.removeOverride(overrideId);
      }
    };
  }

  return {
    optimisticClaimFungibleOrder,
    optimisticCreateOrder,
    optimisticAcceptOffer,
    optimisticCancelOffer,
    optimisticBuildLabor,
    optimisticHarvestLabor,
    optimisticBuildRoad,
  };
}
