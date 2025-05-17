import { ProductionType, useAutomationStore } from "@/hooks/store/use-automation-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ETERNUM_CONFIG } from "@/utils/config";
import { configManager, multiplyByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Account as StarknetAccount } from "starknet";
import { useBlockTimestamp } from "./helpers/use-block-timestamp";

// --- Helper: Get all numeric enum values for ResourcesIds ---
const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((value) => typeof value === "number") as ResourcesIds[];

/**
 * Fetches the current resource balances for a given realm entity ID.
 */
async function fetchBalances(
  tick: number,
  realmEntityId: string,
  dojoComponents: ClientComponents,
): Promise<Record<number, number>> {
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
      const balanceComponent = manager.balanceWithProduction(tick, resourceId);
      balances[resourceId] = Number(balanceComponent.balance);
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
  resourceToUse: ResourcesIds,
  productionType: ProductionType,
): { inputs: { resourceId: ResourcesIds; amount: number }[]; outputAmount: number } | undefined {
  const eternumConfig = ETERNUM_CONFIG();

  if (productionType === ProductionType.ResourceToResource) {
    const recipeInputs = eternumConfig.resources.productionByComplexRecipe[resourceToUse];
    const outputAmount = eternumConfig.resources.productionByComplexRecipeOutputs[resourceToUse];
    if (recipeInputs && typeof outputAmount === "number") {
      return { inputs: recipeInputs.map(({ resource, amount }) => ({ resourceId: resource, amount })), outputAmount };
    }
  } else if (productionType === ProductionType.LaborToResource) {
    const recipeInputs = eternumConfig.resources.productionBySimpleRecipe[resourceToUse];
    const outputAmount = eternumConfig.resources.productionBySimpleRecipeOutputs[resourceToUse];
    if (recipeInputs && typeof outputAmount === "number") {
      return { inputs: recipeInputs.map(({ resource, amount }) => ({ resourceId: resource, amount })), outputAmount };
    }
  } else if (productionType === ProductionType.ResourceToLabor) {
    // For resource to labor, the input is the selected resource, output is labor
    const laborConfig = configManager.getLaborConfig(resourceToUse);
    if (laborConfig && laborConfig.laborProductionPerResource) {
      return {
        inputs: [{ resourceId: resourceToUse, amount: 1 }],
        outputAmount: laborConfig.laborProductionPerResource,
      };
    }
  }
  return undefined;
}

const PROCESS_INTERVAL_MS = 10 * 60 * 1000;
const CYCLE_BUFFER = 150;

export const useAutomation = () => {
  const {
    setup: {
      systemCalls: {
        burn_resource_for_resource_production,
        burn_labor_for_resource_production,
        burn_resource_for_labor_production,
      },
      components,
    },
    account: { account: starknetSignerAccount },
  } = useDojo();
  const { currentDefaultTick } = useBlockTimestamp();

  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);
  const updateOrderProducedAmount = useAutomationStore((state) => state.updateOrderProducedAmount);
  const processingRef = useRef(false);
  const ordersByRealmRef = useRef(ordersByRealm);
  const setNextRunTimestamp = useAutomationStore((state) => state.setNextRunTimestamp);

  // ---- Keep the latest block tick in a ref so that callbacks remain stable ---
  const currentTickRef = useRef(currentDefaultTick);
  useEffect(() => {
    currentTickRef.current = currentDefaultTick;
  }, [currentDefaultTick]);

  useEffect(() => {
    ordersByRealmRef.current = ordersByRealm;
  }, [ordersByRealm]);

  const processOrders = useCallback(async () => {
    if (processingRef.current) return;
    if (
      !starknetSignerAccount ||
      !starknetSignerAccount.address ||
      starknetSignerAccount.address === "0x0" ||
      !components ||
      currentTickRef.current === 0
    ) {
      console.warn("Automation: Conditions not met (signer/components/currentDefaultTick). Skipping.");
      return;
    }

    processingRef.current = true;

    const currentOrdersByRealm = ordersByRealmRef.current;

    for (const realmEntityId in currentOrdersByRealm) {
      const realmOrders = currentOrdersByRealm[realmEntityId].sort((a, b) => a.priority - b.priority);
      if (!realmOrders || realmOrders.length === 0) continue;

      console.log(
        `Automation: Processing orders for realm ${realmEntityId}, ${JSON.stringify(realmOrders, null, 2)} orders found.`,
      );

      for (const order of realmOrders) {
        if (order.maxAmount !== "infinite" && order.producedAmount >= order.maxAmount) {
          console.log(
            `Automation: Order ${order.id} for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId} has already produced ${order.producedAmount} of ${order.maxAmount}. Skipping.`,
          );
          continue;
        }

        try {
          const currentBalances = await fetchBalances(currentTickRef.current, order.realmEntityId, components);
          const recipe = getProductionRecipe(order.resourceToUse, order.productionType);

          console.log(
            `Automation: Recipe for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
            recipe,
          );

          if (!recipe || recipe.outputAmount === 0) {
            console.warn(
              `Automation: No valid recipe or zero output for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}.`,
            );
            continue;
          }

          let maxPossibleCycles = Infinity;
          let insufficientBalance = false;
          if (recipe.inputs.length > 0) {
            for (const input of recipe.inputs) {
              if (input.amount <= 0) continue;
              const balance = currentBalances[input.resourceId] || 0;
              console.log(
                `Automation: Balance for ${ResourcesIds[input.resourceId]} in realm ${order.realmEntityId}, order ${order.id}:`,
                balance,
              );
              if (balance < multiplyByPrecision(input.amount)) {
                console.warn(
                  `Automation: Insufficient balance for ${ResourcesIds[input.resourceId]} in realm ${order.realmEntityId}, order ${order.id}: required ${multiplyByPrecision(input.amount)}, available ${balance}. Skipping order.`,
                );
                insufficientBalance = true;
                break;
              }
              maxPossibleCycles = Math.min(maxPossibleCycles, Math.floor(balance / multiplyByPrecision(input.amount)));
            }
          } else {
            maxPossibleCycles = 10000;
          }

          if (insufficientBalance) continue;

          // Apply cycle buffer to reduce risk of race condition
          maxPossibleCycles = Math.max(1, maxPossibleCycles - CYCLE_BUFFER);

          console.log(
            `Automation: Max possible cycles for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
            maxPossibleCycles,
          );

          if (maxPossibleCycles === 0 || maxPossibleCycles === Infinity) {
            continue;
          }

          let cyclesToRun = maxPossibleCycles;

          if (order.maxAmount !== "infinite") {
            const remainingAmountToProduce = order.maxAmount - order.producedAmount;

            console.log(
              `Automation: Remaining amount to produce for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
              remainingAmountToProduce,
            );
            if (remainingAmountToProduce <= 0) continue;

            const cyclesForRemainingAmount = Math.ceil(remainingAmountToProduce / recipe.outputAmount);
            cyclesToRun = Math.min(cyclesToRun, cyclesForRemainingAmount);

            console.log(
              `Automation: Cycles to run for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
              cyclesToRun,
            );
          }

          if (cyclesToRun <= 0) continue;

          const realmIdNumberForSyscall = Number(order.realmEntityId);
          if (isNaN(realmIdNumberForSyscall)) {
            console.error(`Automation: Invalid realmEntityId for syscall in order ${order.id}: ${order.realmEntityId}`);
            continue;
          }

          const baseCalldata = {
            signer: starknetSignerAccount as StarknetAccount,
            from_entity_id: realmIdNumberForSyscall,
          };

          let producedThisCycle = 0;
          let systemCallToMake = null;

          if (order.productionType === ProductionType.ResourceToResource) {
            const calldata = {
              ...baseCalldata,
              production_cycles: [cyclesToRun],
              produced_resource_types: [order.resourceToUse],
            };
            console.log(
              `Automation: Calldata for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
              calldata,
            );
            systemCallToMake = () => burn_resource_for_resource_production(calldata);
            producedThisCycle = cyclesToRun * recipe.outputAmount;
          } else if (order.productionType === ProductionType.LaborToResource) {
            const calldata = {
              ...baseCalldata,
              production_cycles: [cyclesToRun],
              produced_resource_types: [order.resourceToUse],
            };
            console.log(
              `Automation: Calldata for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
              calldata,
            );
            systemCallToMake = () => burn_labor_for_resource_production(calldata);
            producedThisCycle = cyclesToRun * recipe.outputAmount;
          } else if (order.productionType === ProductionType.ResourceToLabor) {
            const inputAmount = recipe.inputs[0].amount;
            const totalToSpend = cyclesToRun * inputAmount;
            const calldata = {
              signer: starknetSignerAccount as StarknetAccount,
              resource_types: [order.resourceToUse],
              resource_amounts: [multiplyByPrecision(totalToSpend)],
              entity_id: realmIdNumberForSyscall,
            };
            console.log(
              `Automation: Calldata for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
              calldata,
            );
            systemCallToMake = () => burn_resource_for_labor_production(calldata);
            producedThisCycle = cyclesToRun * recipe.outputAmount;
          }

          if (systemCallToMake) {
            console.log(
              `Automation: Plan to execute ${order.productionType} for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id} (${cyclesToRun} cycles, producing ${producedThisCycle}). Calldata `,
            );
            await systemCallToMake(); // UNCOMMENT FOR REAL TRANSACTION
            console.log(
              `Automation: MOCK CALL for ${order.productionType}. Would produce ${producedThisCycle} of ${ResourcesIds[order.resourceToUse]}.`,
            );
            updateOrderProducedAmount(order.realmEntityId, order.id, producedThisCycle);
            if (order.productionType === ProductionType.ResourceToLabor) {
              toast.success(
                <div className="flex">
                  <ResourceIcon className="inline-block" resource={ResourcesIds[order.resourceToUse]} size="sm" />
                  <span className="ml-2">
                    Automation:{" "}
                    {order.productionType === ProductionType.ResourceToLabor
                      ? "Resource To Labor"
                      : order.productionType === ProductionType.ResourceToResource
                        ? "Resource To Resource"
                        : order.productionType === ProductionType.LaborToResource
                          ? "Labor To Resource"
                          : order.productionType}
                    . Produced {producedThisCycle.toLocaleString()} labor from {ResourcesIds[order.resourceToUse]} on
                    realm {order?.realmName},
                  </span>
                </div>,
              );
            } else {
              toast.success(
                <div className="flex">
                  <ResourceIcon className="inline-block" resource={ResourcesIds[order.resourceToUse]} size="sm" />
                  <span className="ml-2">
                    Automation: Resource To Labor. Produced {producedThisCycle.toLocaleString()} of{" "}
                    {ResourcesIds[order.resourceToUse]} on {order?.realmName}.
                  </span>
                </div>,
              );
            }
          } else {
            console.warn(
              `Automation: No system call for order ${order.id} (type ${order.productionType}) in realm ${order?.realmName}.`,
            );
          }
        } catch (error) {
          console.error(
            `Automation: Error processing order ${order.id} for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}:`,
            error,
          );
        }
      }
    }
    processingRef.current = false;
  }, [
    starknetSignerAccount,
    components,
    currentTickRef,
    burn_resource_for_resource_production,
    burn_labor_for_resource_production,
    updateOrderProducedAmount,
  ]);

  // Setup the automation interval as soon as the hook mounts. The `processOrders` function
  // contains its own early-exit checks, so we don't need to guard here – this ensures the
  // interval is created immediately and will start working as soon as the required data is
  // available.
  useEffect(() => {
    const runAndSchedule = async () => {
      await processOrders();
      setNextRunTimestamp(Date.now() + PROCESS_INTERVAL_MS);
    };

    runAndSchedule(); // Initial run and schedule
    const intervalId = setInterval(runAndSchedule, PROCESS_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      processingRef.current = false;
    };
    // `processOrders` is a stable callback (its deps are managed in its own definition) so we
    // can safely depend only on it here.
    // Add setNextRunTimestamp to dependency array, it's stable from Zustand though.
  }, [processOrders, setNextRunTimestamp]);

  return {};
};
