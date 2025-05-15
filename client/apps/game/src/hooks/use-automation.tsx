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
  // console.log(`MOCK: Getting recipe for resource ${resourceToProduce} (${productionType})`);
  // This should ideally pull from a structure similar to configManager.complexSystemResourceInputs
  // and configManager.getLaborConfig, and consider configManager.complexSystemResourceOutput for outputAmount.
  if (productionType === "resource") {
    if (resourceToProduce === ResourcesIds.Wheat) {
      return { inputs: [{ resourceId: ResourcesIds.Wood, amount: 10 }], outputAmount: 5 }; // outputAmount is per cycle
    }
    if (resourceToProduce === ResourcesIds.Copper) {
      return { inputs: [{ resourceId: ResourcesIds.Coal, amount: 5 }], outputAmount: 2 }; // outputAmount is per cycle
    }
  } else if (productionType === "labor") {
    // Example for labor - outputAmount here would be akin to laborConfig.resourceOutputPerInputResources
    if (resourceToProduce === ResourcesIds.Fish) {
      // Assuming Fish can be made with labor
      return { inputs: [{ resourceId: ResourcesIds.Labor, amount: 100 }], outputAmount: 20 }; // e.g. 100 labor units for 20 fish
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
    if (!starknetSignerAccount || !starknetSignerAccount.address || starknetSignerAccount.address === "0x0") {
      console.warn("Automation: No valid Starknet signer account.");
      return;
    }
    if (!components) {
      console.warn("Automation: Dojo components not available.");
      return;
    }

    processingRef.current = true;
    // console.log("Automation: Starting order processing cycle...");

    const sortedOrders = [...orders].sort((a, b) => a.priority - b.priority);

    for (const order of sortedOrders) {
      if (order.maxAmount !== "infinite" && order.producedAmount >= order.maxAmount) continue;

      try {
        const currentBalances = await fetchBalances(order.realmEntityId, components);
        const recipe = getProductionRecipe(order.resourceToProduce, order.productionType);

        if (!recipe) {
          console.warn(
            `Automation: No recipe for ${ResourcesIds[order.resourceToProduce]} (type: ${order.productionType}) in order ${order.id}.`,
          );
          continue;
        }

        let canProduce = true;
        for (const input of recipe.inputs) {
          if ((currentBalances[input.resourceId] || 0) < input.amount) {
            canProduce = false;
            // console.log(`Automation: Not enough ${ResourcesIds[input.resourceId]} for order ${order.id}. Need ${input.amount}, have ${currentBalances[input.resourceId] || 0}`);
            break;
          }
        }

        if (canProduce) {
          // console.log(`Automation: Processing order ${order.id} for resource ${ResourcesIds[order.resourceToProduce]}.`);

          const realmEntityIdNumber = Number(order.realmEntityId);
          if (isNaN(realmEntityIdNumber)) {
            console.error(`Automation: Invalid realmEntityId in order ${order.id}: ${order.realmEntityId}`);
            continue;
          }

          const baseCalldata = {
            signer: starknetSignerAccount as StarknetAccount, // Ensure type is StarknetAccount
            from_entity_id: realmEntityIdNumber,
          };

          let producedThisCycle = 0;
          let systemCallToMake = null;

          if (order.productionType === "resource") {
            const calldata = {
              ...baseCalldata,
              production_cycles: [1], // Automation does 1 cycle at a time
              produced_resource_types: [order.resourceToProduce],
            };
            systemCallToMake = () => burn_resource_for_resource_production(calldata);
            producedThisCycle = recipe.outputAmount;
          } else if (order.productionType === "labor") {
            const calldata = {
              ...baseCalldata,
              production_cycles: [1], // Automation does 1 cycle at a time
              produced_resource_types: [order.resourceToProduce],
            };
            systemCallToMake = () => burn_labor_for_resource_production(calldata);
            producedThisCycle = recipe.outputAmount;
          }

          if (systemCallToMake) {
            console.log(
              `Automation: Executing ${order.productionType} production for ${ResourcesIds[order.resourceToProduce]} in order ${order.id}.`,
            );
            // await systemCallToMake(); // UNCOMMENT TO ENABLE ACTUAL TRANSACTION
            console.log(
              `Automation: MOCK CALL for ${order.productionType} production. Produced ${producedThisCycle} of ${ResourcesIds[order.resourceToProduce]}.`,
            );
            // For testing without real transactions, we assume success:
            updateOrderProducedAmount(order.id, producedThisCycle);
          } else {
            console.warn(`Automation: No system call defined for order ${order.id} with type ${order.productionType}`);
          }
        }
      } catch (error) {
        console.error(
          `Automation: Error processing order ${order.id} for ${ResourcesIds[order.resourceToProduce]}:`,
          error,
        );
      }
    }
    processingRef.current = false;
    // console.log("Automation: Finished order processing cycle.");
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
      // console.log("Automation: Conditions not met for initial processing or interval setup.");
      return; // Don't start if account or components aren't ready
    }
    // console.log("Automation: Hook mounted, account and components ready, setting up interval.");
    processOrders(); // Initial run
    const intervalId = setInterval(processOrders, PROCESS_INTERVAL_MS);
    return () => {
      // console.log("Automation: Hook unmounting, clearing interval.");
      clearInterval(intervalId);
      processingRef.current = false;
    };
  }, [processOrders, starknetSignerAccount?.address, components]);

  return {};
};
