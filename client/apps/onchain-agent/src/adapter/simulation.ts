import type { SimulationResult, GameAction } from "@bibliothecadao/game-agent";
import { computeStrength, computeOutputAmount, computeBuildingCost } from "@bibliothecadao/client";

function requireParam(params: Record<string, unknown>, name: string): number {
  const v = params[name];
  if (v === undefined || v === null) {
    throw new Error(`Missing required parameter: ${name}`);
  }
  return Number(v);
}

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
        return {
          success: true,
          outcome: {
            message:
              "Use the simulate_battle or simulate_raid tool instead — " +
              "they provide full damage predictions with biome bonuses and tier multipliers.",
          },
        };
      }

      case "create_explorer":
      case "add_guard": {
        const troops = requireParam(action.params, "amount");
        const tier = requireParam(action.params, "tier");
        const strength = computeStrength(troops, tier);
        return {
          success: true,
          outcome: { strength },
          cost: { troops },
        };
      }

      case "buy_resources":
      case "sell_resources": {
        const amount = requireParam(action.params, "amount");
        const reserveIn = requireParam(action.params, "reserveIn");
        const reserveOut = requireParam(action.params, "reserveOut");
        const feeNum = requireParam(action.params, "feeNum");
        const feeDenom = requireParam(action.params, "feeDenom");
        const output = computeOutputAmount(amount, reserveIn, reserveOut, feeNum, feeDenom);
        return {
          success: true,
          outcome: { estimatedOutput: output, inputAmount: amount },
          cost: { inputAmount: amount },
        };
      }

      case "create_building": {
        const category = requireParam(action.params, "buildingCategory");
        const baseCosts = action.params.baseCosts;
        if (!Array.isArray(baseCosts) || baseCosts.length === 0) {
          return {
            success: false,
            error: "baseCosts array is required for building cost simulation.",
          };
        }

        const parsedCosts = baseCosts.map((cost: any) => ({
          resourceId: requireParam(cost, "resourceId"),
          name: String(cost?.name ?? ""),
          amount: requireParam(cost, "amount"),
        }));
        const existingCount = requireParam(action.params, "existingCount");
        const costPercentIncrease = requireParam(action.params, "costPercentIncrease");

        const costs = computeBuildingCost(parsedCosts, existingCount, costPercentIncrease);
        return {
          success: true,
          outcome: { buildingCategory: category },
          cost: { resources: costs },
        };
      }

      default:
        return {
          success: false,
          error: `No simulation model for action type: ${action.type}. Use simulate_battle for combat predictions.`,
        };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? String(err),
    };
  }
}
