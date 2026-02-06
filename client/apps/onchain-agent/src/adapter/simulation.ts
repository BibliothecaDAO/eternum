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
        const output = computeOutputAmount(amount, reserveIn, reserveOut);
        return {
          success: true,
          outcome: { estimatedOutput: output, inputAmount: amount },
          cost: { inputAmount: amount },
        };
      }

      case "create_building": {
        const category = Number(action.params.buildingCategory ?? 0);
        const costs = computeBuildingCost(category);
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
