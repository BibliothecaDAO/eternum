import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { Account as StarknetAccount } from "starknet";
import { useAutomationStore } from "../stores/automation-store";

// --- Helper: Get all numeric enum values for ResourcesIds ---
const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((value) => typeof value === "number") as ResourcesIds[];

/**
 * Fetches the current resource balances for a given realm entity ID.
 */
async function fetchBalances(realmEntityId: string, dojoComponents: ClientComponents): Promise<Record<number, number>> {
  // console.log(`Fetching balances for realm ${realmEntityId} using ResourceManager.`);
  const balances: Record<number, number> = {};
  try {
    const realmIdNumber = Number(realmEntityId);
    if (isNaN(realmIdNumber)) {
      console.error(`Invalid realmEntityId for fetchBalances: ${realmEntityId}`);
      return {};
    }
    const manager = new ResourceManager(dojoComponents, realmIdNumber);
    for (const resourceId of ALL_RESOURCE_IDS) {
      balances[resourceId] = Number(manager.balance(resourceId));
    }
  } catch (error) {
    console.error(`Error fetching balances for realm ${realmEntityId}:`, error);
  }
  return balances;
}

/**
 * Gets the production recipe for a given resource.
 * Replace with your actual game config/data.
 */
function getProductionRecipe(
  resourceToProduce: ResourcesIds,
  productionType: "resource" | "labor",
): { inputs: { resourceId: ResourcesIds; amount: number }[]; outputAmount: number } | undefined {
  const eternumConfig = ETERNUM_CONFIG();

  if (productionType === "resource") {
    const recipeInputs = eternumConfig.resources.productionByComplexRecipe[resourceToProduce];
    const outputAmount = eternumConfig.resources.productionByComplexRecipeOutputs[resourceToProduce];
    if (recipeInputs && typeof outputAmount === "number") {
      return { inputs: recipeInputs.map(({ resource, amount }) => ({ resourceId: resource, amount })), outputAmount };
    }
  } else if (productionType === "labor") {
    const recipeInputs = eternumConfig.resources.productionBySimpleRecipe[resourceToProduce];
    const outputAmount = eternumConfig.resources.productionBySimpleRecipeOutputs[resourceToProduce];
    if (recipeInputs && typeof outputAmount === "number") {
      return { inputs: recipeInputs.map(({ resource, amount }) => ({ resourceId: resource, amount })), outputAmount };
    }
  }
  return undefined;
}

const PROCESS_INTERVAL_MS = 1 * 60 * 1000; // Changed from TEN_MINUTES_MS for clarity

export const useAutomation = () => {
  const {
    setup: {
      systemCalls: { burn_resource_for_resource_production, burn_labor_for_resource_production },
      components,
    },
    account: { account: starknetSignerAccount }, // Assuming useDojo().account.account is the StarknetAccount
  } = useDojo();

  const orders = useAutomationStore((state) => state.orders);
  const updateOrderProducedAmount = useAutomationStore((state) => state.updateOrderProducedAmount);
  const processingRef = useRef(false);

  const processOrders = useCallback(async () => {
    if (processingRef.current) return;
    if (
      !starknetSignerAccount ||
      !starknetSignerAccount.address ||
      starknetSignerAccount.address === "0x0" ||
      !components
    ) {
      console.warn("Automation: Conditions not met (signer/components). Skipping.");
      return;
    }

    processingRef.current = true;
    const sortedOrders = [...orders].sort((a, b) => a.priority - b.priority);

    for (const order of sortedOrders) {
      if (order.maxAmount !== "infinite" && order.producedAmount >= order.maxAmount) continue;

      try {
        const currentBalances = await fetchBalances(order.realmEntityId, components);
        const recipe = getProductionRecipe(order.resourceToProduce, order.productionType);

        if (!recipe || recipe.outputAmount === 0) {
          console.warn(
            `Automation: No valid recipe or zero output amount for ${ResourcesIds[order.resourceToProduce]} (type: ${order.productionType}) in order ${order.id}.`,
          );
          continue;
        }

        let maxPossibleCycles = Infinity;
        if (recipe.inputs.length > 0) {
          for (const input of recipe.inputs) {
            if (input.amount <= 0) continue; // Skip if input amount is zero or negative (should not happen in valid recipe)
            const balance = currentBalances[input.resourceId] || 0;
            maxPossibleCycles = Math.min(maxPossibleCycles, Math.floor(balance / input.amount));
          }
        } else {
          // If no inputs, theoretically infinite cycles, but will be capped by maxAmount or a default
          maxPossibleCycles = 1000; // Default cap for no-input recipes, adjust as needed
        }

        if (maxPossibleCycles === 0 || maxPossibleCycles === Infinity) {
          // console.log(`Automation: Cannot produce ${ResourcesIds[order.resourceToProduce]} for order ${order.id} due to resource constraints (maxPossibleCycles: ${maxPossibleCycles}).`);
          continue;
        }

        let cyclesToRun = maxPossibleCycles;

        if (order.maxAmount !== "infinite") {
          const remainingAmountToProduce = order.maxAmount - order.producedAmount;
          if (remainingAmountToProduce <= 0) continue; // Should have been caught by earlier check, but good for safety

          const cyclesForRemainingAmount = Math.ceil(remainingAmountToProduce / recipe.outputAmount);
          cyclesToRun = Math.min(cyclesToRun, cyclesForRemainingAmount);
        }

        if (cyclesToRun <= 0) {
          // console.log(`Automation: No cycles to run for ${ResourcesIds[order.resourceToProduce]} in order ${order.id}.`);
          continue;
        }

        const realmEntityIdNumber = Number(order.realmEntityId);
        if (isNaN(realmEntityIdNumber)) {
          console.error(`Automation: Invalid realmEntityId in order ${order.id}: ${order.realmEntityId}`);
          continue;
        }

        const baseCalldata = {
          signer: starknetSignerAccount as StarknetAccount,
          from_entity_id: realmEntityIdNumber,
        };

        let producedThisCycle = 0;
        let systemCallToMake = null;

        if (order.productionType === "resource") {
          const calldata = {
            ...baseCalldata,
            production_cycles: [cyclesToRun],
            produced_resource_types: [order.resourceToProduce],
          };
          systemCallToMake = () => burn_resource_for_resource_production(calldata);
          producedThisCycle = cyclesToRun * recipe.outputAmount;
        } else if (order.productionType === "labor") {
          const calldata = {
            ...baseCalldata,
            production_cycles: [cyclesToRun],
            produced_resource_types: [order.resourceToProduce],
          };
          systemCallToMake = () => burn_labor_for_resource_production(calldata);
          producedThisCycle = cyclesToRun * recipe.outputAmount;
        }

        if (systemCallToMake) {
          console.log(
            `Automation: Plan to execute ${order.productionType} production for ${ResourcesIds[order.resourceToProduce]} in order ${order.id} (${cyclesToRun} cycles, producing ${producedThisCycle}).`,
          );
          // await systemCallToMake(); // UNCOMMENT TO ENABLE ACTUAL TRANSACTION
          console.log(
            `Automation: MOCK CALL for ${order.productionType} production. Would produce ${producedThisCycle} of ${ResourcesIds[order.resourceToProduce]}.`,
          );
          updateOrderProducedAmount(order.id, producedThisCycle);
        } else {
          console.warn(`Automation: No system call defined for order ${order.id} with type ${order.productionType}`);
        }
      } catch (error) {
        console.error(
          `Automation: Error processing order ${order.id} for ${ResourcesIds[order.resourceToProduce]}:`,
          error,
        );
      }
    }
    processingRef.current = false;
  }, [
    orders,
    starknetSignerAccount,
    components,
    burn_resource_for_resource_production,
    burn_labor_for_resource_production,
    updateOrderProducedAmount,
  ]);

  useEffect(() => {
    if (
      !starknetSignerAccount ||
      !starknetSignerAccount.address ||
      starknetSignerAccount.address === "0x0" ||
      !components
    ) {
      return;
    }
    processOrders();
    const intervalId = setInterval(processOrders, PROCESS_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      processingRef.current = false;
    };
  }, [processOrders, starknetSignerAccount?.address, components]);

  return {};
};
