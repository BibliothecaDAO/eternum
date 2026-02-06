import type { SimulationResult, GameAction } from "@mariozechner/pi-onchain-agent";
import {
  computeStrength,
  computeOutputAmount,
  computeBuildingCost,
} from "@bibliothecadao/client";

/**
 * Simulate a game action using pure compute functions.
 * Returns predicted outcomes without executing on chain.
 */
export function simulateAction(action: GameAction): SimulationResult {
  try {
    switch (action.type) {
      case "attack_explorer":
      case "attack_guard":
      case "guard_attack_explorer":
      case "raid": {
        const troops = Number(action.params.amount ?? action.params.count ?? 0);
        const tier = Number(action.params.tier ?? 1);
        const strength = computeStrength(troops, tier);
        return {
          success: true,
          outcome: { estimatedStrength: strength },
          cost: { troops },
        };
      }

      case "create_explorer":
      case "add_guard": {
        const troops = Number(action.params.amount ?? 0);
        const tier = Number(action.params.tier ?? 1);
        const strength = computeStrength(troops, tier);
        return {
          success: true,
          outcome: { strength },
          cost: { troops },
        };
      }

      case "buy_resources":
      case "sell_resources": {
        const amount = Number(action.params.amount ?? 0);
        const reserveIn = Number(action.params.reserveIn ?? 1000);
        const reserveOut = Number(action.params.reserveOut ?? 1000);
        const feeNum = Number(action.params.feeNum ?? 0);
        const feeDenom = Number(action.params.feeDenom ?? 1000);
        const output = computeOutputAmount(amount, reserveIn, reserveOut, feeNum, feeDenom);
        return {
          success: true,
          outcome: { estimatedOutput: output, inputAmount: amount },
          cost: { inputAmount: amount },
        };
      }

      case "create_building": {
        const category = Number(action.params.buildingCategory ?? 0);
        const baseCosts = Array.isArray(action.params.baseCosts)
          ? action.params.baseCosts
              .map((cost: any) => ({
                resourceId: Number(cost?.resourceId ?? 0),
                name: String(cost?.name ?? ""),
                amount: Number(cost?.amount ?? 0),
              }))
              .filter((cost) => Number.isFinite(cost.resourceId) && cost.amount >= 0)
          : [];
        const existingCount = Number(action.params.existingCount ?? 0);
        const costPercentIncrease = Number(action.params.costPercentIncrease ?? 0);

        if (baseCosts.length === 0) {
          return {
            success: true,
            outcome: {
              buildingCategory: category,
              message: "No baseCosts provided; cannot estimate resource cost.",
            },
          };
        }

        const costs = computeBuildingCost(baseCosts, existingCount, costPercentIncrease);
        return {
          success: true,
          outcome: { buildingCategory: category },
          cost: { resources: costs },
        };
      }

      default:
        return {
          success: true,
          outcome: { message: `No simulation model for action type: ${action.type}` },
        };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? String(err),
    };
  }
}
