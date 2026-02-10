import type { SimulationResult, GameAction } from "@bibliothecadao/game-agent";
import {
  computeStrength,
  computeStaminaModifier,
  computeCooldownModifier,
  computeOutputAmount,
  computeSlippage,
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

        // Compute stamina and cooldown modifiers if params are provided
        const attackerStamina = action.params.attackerStamina != null ? Number(action.params.attackerStamina) : undefined;
        const defenderStamina = action.params.defenderStamina != null ? Number(action.params.defenderStamina) : undefined;
        const attackReq = Number(action.params.attackReq ?? 0);
        const defenseReq = Number(action.params.defenseReq ?? 0);
        const attackerCooldownEnd = Number(action.params.attackerCooldownEnd ?? 0);
        const defenderCooldownEnd = Number(action.params.defenderCooldownEnd ?? 0);
        const currentTime = Number(action.params.currentTime ?? Math.floor(Date.now() / 1000));

        if (attackerStamina != null) {
          const attackerStaminaMod = computeStaminaModifier(attackerStamina, true, attackReq, defenseReq);
          const defenderStaminaMod = defenderStamina != null
            ? computeStaminaModifier(defenderStamina, false, attackReq, defenseReq)
            : 1;
          const attackerCooldownMod = computeCooldownModifier(attackerCooldownEnd, currentTime, true);
          const defenderCooldownMod = computeCooldownModifier(defenderCooldownEnd, currentTime, false);

          const effectiveAttackerStrength = strength * attackerStaminaMod * attackerCooldownMod;
          const effectiveDefenderStrength = strength * defenderStaminaMod * defenderCooldownMod;

          return {
            success: true,
            outcome: {
              estimatedStrength: strength,
              effectiveAttackerStrength,
              effectiveDefenderStrength,
              canAttack: attackerStaminaMod > 0 && attackerCooldownMod > 0,
              attackerPenalties: {
                staminaModifier: attackerStaminaMod,
                cooldownModifier: attackerCooldownMod,
              },
              defenderPenalties: {
                staminaModifier: defenderStaminaMod,
                cooldownModifier: defenderCooldownMod,
              },
              predictedWinner: effectiveAttackerStrength > effectiveDefenderStrength ? "attacker" : "defender",
              warning: attackerStaminaMod === 0 ? "CANNOT ATTACK: Insufficient stamina" :
                       attackerCooldownMod === 0 ? "CANNOT ATTACK: On cooldown" : undefined,
            },
            cost: { troops },
          };
        }

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
        const slippagePercent = amount > 0 ? computeSlippage(amount, reserveIn, reserveOut) : 0;
        return {
          success: true,
          outcome: {
            estimatedOutput: output,
            inputAmount: amount,
            slippagePercent,
            priceImpact: slippagePercent > 5 ? "HIGH - consider smaller trade" : "acceptable",
          },
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

      case "move_explorer": {
        const pathLength = Array.isArray(action.params.directions)
          ? action.params.directions.length
          : Number(action.params.pathLength ?? 1);
        const isExplore = Boolean(action.params.explore ?? false);
        const explorerStamina = Number(action.params.explorerStamina ?? 0);
        const exploreCost = Number(action.params.exploreCost ?? 30);
        const travelCost = Number(action.params.travelCost ?? 20);
        const staminaCostPerStep = isExplore ? exploreCost : travelCost;
        const totalStaminaCost = pathLength * staminaCostPerStep;

        const exploreWheatCost = Number(action.params.exploreWheatCost ?? 0);
        const exploreFishCost = Number(action.params.exploreFishCost ?? 0);
        const travelWheatCost = Number(action.params.travelWheatCost ?? 0);
        const travelFishCost = Number(action.params.travelFishCost ?? 0);

        const wheatCostPerStep = isExplore ? exploreWheatCost : travelWheatCost;
        const fishCostPerStep = isExplore ? exploreFishCost : travelFishCost;

        return {
          success: true,
          outcome: {
            totalStaminaCost,
            currentStamina: explorerStamina,
            canComplete: explorerStamina >= totalStaminaCost,
            wheatCost: pathLength * wheatCostPerStep,
            fishCost: pathLength * fishCostPerStep,
            stepsAffordable: staminaCostPerStep > 0 ? Math.floor(explorerStamina / staminaCostPerStep) : pathLength,
          },
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
