import { OrderMode, ProductionType, TransferMode, useAutomationStore } from "@/hooks/store/use-automation-store";
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
 * Fetches the projected resource balance including pending production.
 * This is crucial for MaintainBalance mode to avoid overproduction.
 */
async function getProjectedBalance(
  tick: number,
  realmEntityId: string,
  resourceId: ResourcesIds,
  dojoComponents: ClientComponents,
): Promise<number> {
  try {
    const realmIdNumber = Number(realmEntityId);
    if (isNaN(realmIdNumber)) {
      console.error(`Invalid realmEntityId for getProjectedBalance: ${realmEntityId}`);
      return 0;
    }
    const manager = new ResourceManager(dojoComponents, realmIdNumber);

    // Get the time until current production ends
    const ticksUntilProductionEnds = manager.timeUntilValueReached(tick, resourceId);

    // If no pending production, return current balance
    if (ticksUntilProductionEnds === 0) {
      const currentBalance = manager.balanceWithProduction(tick, resourceId);
      return currentBalance.balance;
    }

    // Calculate the balance after all pending production completes
    const futureBalance = manager.balanceWithProduction(tick + ticksUntilProductionEnds, resourceId);

    console.log(
      `Automation: Projected balance for ${ResourcesIds[resourceId]} after ${ticksUntilProductionEnds} ticks: ${futureBalance.balance} (current production will complete)`,
    );

    return futureBalance.balance;
  } catch (error) {
    console.error(`Error getting projected balance for resource ${resourceId}:`, error);
    return 0;
  }
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

const PROCESS_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CYCLE_BUFFER = 150;

export const useAutomation = () => {
  const {
    setup: {
      systemCalls: {
        burn_resource_for_resource_production,
        burn_labor_for_resource_production,
        burn_resource_for_labor_production,
        send_resources,
      },
      components,
    },
    account: { account: starknetSignerAccount },
  } = useDojo();
  const { currentDefaultTick } = useBlockTimestamp();

  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);
  const updateOrderProducedAmount = useAutomationStore((state) => state.updateOrderProducedAmount);
  const updateTransferTimestamp = useAutomationStore((state) => state.updateTransferTimestamp);
  const isRealmPaused = useAutomationStore((state) => state.isRealmPaused);
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
      // Check if realm is paused
      if (isRealmPaused(realmEntityId)) {
        console.log(`Automation: Realm ${realmEntityId} is paused. Skipping all orders.`);
        continue;
      }

      const realmOrders = currentOrdersByRealm[realmEntityId].sort((a, b) => a.priority - b.priority);
      if (!realmOrders || realmOrders.length === 0) continue;

      console.log(
        `Automation: Processing orders for realm ${realmEntityId}, ${JSON.stringify(realmOrders, null, 2)} orders found.`,
      );

      for (const order of realmOrders) {
        // For ProduceOnce mode, check if we've already produced enough
        if (
          order.mode === OrderMode.ProduceOnce &&
          order.maxAmount !== "infinite" &&
          order.producedAmount >= order.maxAmount &&
          order.productionType !== ProductionType.Transfer // Transfer orders don't use producedAmount
        ) {
          console.log(
            `Automation: Order ${order.id} for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId} has already produced ${order.producedAmount} of ${order.maxAmount}. Skipping.`,
          );
          continue;
        }

        // Handle transfer orders separately
        if (order.productionType === ProductionType.Transfer) {
          try {
            // Check if it's time to transfer based on the mode
            let shouldTransfer = false;

            if (order.transferMode === TransferMode.Recurring) {
              // Check if enough time has passed since last transfer
              const now = Date.now();
              const lastTransfer = order.lastTransferTimestamp || 0;
              const intervalMs = (order.transferInterval || 60) * 60 * 1000; // Convert minutes to ms
              shouldTransfer = now - lastTransfer >= intervalMs;

              if (!shouldTransfer) {
                console.log(
                  `Automation: Transfer order ${order.id} not due yet. Next transfer in ${Math.ceil((intervalMs - (now - lastTransfer)) / 1000 / 60)} minutes.`,
                );
                continue;
              }
            } else if (
              order.transferMode === TransferMode.MaintainStock ||
              order.transferMode === TransferMode.DepletionTransfer
            ) {
              // For threshold-based transfers, we need to check balances
              const targetBalances = await fetchBalances(currentTickRef.current, order.targetEntityId!, components);
              const sourceBalances = await fetchBalances(currentTickRef.current, order.realmEntityId, components);

              // Check the first resource in the transfer list as the trigger
              const triggerResource = order.transferResources?.[0];
              if (triggerResource) {
                if (order.transferMode === TransferMode.MaintainStock) {
                  // Transfer if destination is below threshold
                  const targetBalance = targetBalances[triggerResource.resourceId] || 0;
                  shouldTransfer = targetBalance < multiplyByPrecision(order.transferThreshold || 0);
                } else {
                  // Transfer if source is above threshold
                  const sourceBalance = sourceBalances[triggerResource.resourceId] || 0;
                  shouldTransfer = sourceBalance > multiplyByPrecision(order.transferThreshold || 0);
                }
              }
            }

            if (!shouldTransfer) continue;

            // Check if source has enough resources
            const sourceBalances = await fetchBalances(currentTickRef.current, order.realmEntityId, components);
            const resourcesToTransfer: { resource: ResourcesIds; amount: number }[] = [];
            let hasEnoughResources = true;

            for (const resource of order.transferResources || []) {
              const requiredAmount = multiplyByPrecision(resource.amount);
              const availableAmount = sourceBalances[resource.resourceId] || 0;

              if (availableAmount < requiredAmount) {
                console.warn(
                  `Automation: Not enough ${ResourcesIds[resource.resourceId]} for transfer. Required: ${requiredAmount}, Available: ${availableAmount}`,
                );
                hasEnoughResources = false;
                break;
              }

              resourcesToTransfer.push({
                resource: resource.resourceId,
                amount: requiredAmount,
              });
            }

            if (!hasEnoughResources) continue;

            // Execute the transfer
            console.log(
              `Automation: Executing transfer from ${order.realmName} to ${order.targetEntityName}`,
              resourcesToTransfer,
            );

            await send_resources({
              signer: starknetSignerAccount as StarknetAccount,
              sender_entity_id: Number(order.realmEntityId),
              recipient_entity_id: Number(order.targetEntityId),
              resources: resourcesToTransfer,
            });

            console.log(
              `Automation: MOCK TRANSFER from ${order.realmName} to ${order.targetEntityName}`,
              resourcesToTransfer,
            );

            // Update last transfer timestamp for recurring transfers
            if (order.transferMode === TransferMode.Recurring) {
              updateTransferTimestamp(order.realmEntityId, order.id);
              console.log(`Automation: Updated last transfer timestamp for order ${order.id}`);
            }

            toast.success(
              <div className="flex flex-col">
                <span className="font-bold">Automation: Transfer Completed</span>
                <span className="text-sm">
                  From {order.realmName} to {order.targetEntityName}
                </span>
                <div className="flex gap-2 mt-1">
                  {order.transferResources?.map((res, idx) => (
                    <div key={idx} className="flex items-center">
                      <ResourceIcon resource={ResourcesIds[res.resourceId]} size="xs" className="mr-1" />
                      <span className="text-xs">{res.amount}</span>
                    </div>
                  ))}
                </div>
              </div>,
            );
          } catch (error) {
            console.error(`Automation: Error processing transfer order ${order.id}:`, error);
          }
          continue; // Skip to next order after handling transfer
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

          // For MaintainBalance mode, check if we need to produce
          if (order.mode === OrderMode.MaintainBalance) {
            const targetBalance = order.maxAmount as number;

            // Determine which resource we're trying to maintain
            let resourceToMaintain: ResourcesIds;
            if (order.productionType === ProductionType.ResourceToLabor) {
              // For ResourceToLabor, we're maintaining Labor balance
              resourceToMaintain = ResourcesIds.Labor;
            } else {
              // For other production types, we're maintaining the output resource balance
              resourceToMaintain = order.resourceToUse;
            }

            const currentBalance = currentBalances[resourceToMaintain] || 0;
            const projectedBalance = await getProjectedBalance(
              currentTickRef.current,
              order.realmEntityId,
              resourceToMaintain,
              components,
            );

            const targetBalanceInPrecision = multiplyByPrecision(targetBalance);
            const bufferPercentage = order.bufferPercentage || 10; // Default 10% buffer
            const bufferAmount = targetBalanceInPrecision * (bufferPercentage / 100);
            const triggerBalance = targetBalanceInPrecision - bufferAmount;

            console.log(
              `Automation: MaintainBalance mode for ${ResourcesIds[resourceToMaintain]} - Current: ${currentBalance}, Projected: ${projectedBalance}, Target: ${targetBalanceInPrecision}, Trigger: ${triggerBalance}`,
            );

            // If projected balance (after pending production) is above trigger threshold, skip
            if (projectedBalance >= triggerBalance) {
              console.log(
                `Automation: Projected balance for ${ResourcesIds[resourceToMaintain]} is sufficient (${projectedBalance} >= ${triggerBalance}). Skipping.`,
              );
              continue;
            }
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

          if (order.mode === OrderMode.ProduceOnce && order.maxAmount !== "infinite") {
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
          } else if (order.mode === OrderMode.MaintainBalance) {
            // Calculate how much we need to produce to reach target
            const targetBalance = order.maxAmount as number;

            // Determine which resource we're trying to maintain
            let resourceToMaintain: ResourcesIds;
            if (order.productionType === ProductionType.ResourceToLabor) {
              // For ResourceToLabor, we're maintaining Labor balance
              resourceToMaintain = ResourcesIds.Labor;
            } else {
              // For other production types, we're maintaining the output resource balance
              resourceToMaintain = order.resourceToUse;
            }

            const currentBalance = currentBalances[resourceToMaintain] || 0;
            const projectedBalance = await getProjectedBalance(
              currentTickRef.current,
              order.realmEntityId,
              resourceToMaintain,
              components,
            );
            const targetBalanceInPrecision = multiplyByPrecision(targetBalance);
            const amountNeeded = targetBalanceInPrecision - projectedBalance;

            if (amountNeeded <= 0) continue;

            // Convert output amount to precision units for correct calculation
            const outputAmountInPrecision = multiplyByPrecision(recipe.outputAmount);
            const cyclesForTargetAmount = Math.ceil(amountNeeded / outputAmountInPrecision);
            cyclesToRun = Math.min(cyclesToRun, cyclesForTargetAmount);

            console.log(
              `Automation: MaintainBalance - Current: ${currentBalance}, Projected: ${projectedBalance}, Need ${amountNeeded} ${ResourcesIds[resourceToMaintain]} (precision units) to reach target. Output per cycle: ${outputAmountInPrecision} (precision units). Cycles to run: ${cyclesToRun}`,
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
            const producedResourceName =
              order.productionType === ProductionType.ResourceToLabor ? "Labor" : ResourcesIds[order.resourceToUse];
            console.log(
              `Automation: MOCK CALL for ${order.productionType}. Would produce ${producedThisCycle} of ${producedResourceName}.`,
            );
            updateOrderProducedAmount(order.realmEntityId, order.id, producedThisCycle);
            if (order.productionType === ProductionType.ResourceToLabor) {
              toast.success(
                <div className="flex">
                  <ResourceIcon className="inline-block" resource={ResourcesIds[order.resourceToUse]} size="sm" />
                  <span className="ml-2">
                    Automation: Resource To Labor. Produced {producedThisCycle.toLocaleString()} labor from{" "}
                    {ResourcesIds[order.resourceToUse]} on realm {order?.realmName}.
                  </span>
                </div>,
              );
            } else {
              toast.success(
                <div className="flex">
                  <ResourceIcon className="inline-block" resource={ResourcesIds[order.resourceToUse]} size="sm" />
                  <span className="ml-2">
                    Automation:{" "}
                    {order.productionType === ProductionType.ResourceToResource
                      ? "Resource To Resource"
                      : order.productionType === ProductionType.LaborToResource
                        ? "Labor To Resource"
                        : order.productionType}
                    . Produced {producedThisCycle.toLocaleString()} of {ResourcesIds[order.resourceToUse]} on{" "}
                    {order?.realmName}.
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
    burn_resource_for_labor_production,
    updateOrderProducedAmount,
    isRealmPaused,
    updateTransferTimestamp,
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
