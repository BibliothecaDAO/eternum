import { AutomationOrder, OrderMode, ProductionType, TransferMode } from "@/hooks/store/use-automation-store";
import { ETERNUM_CONFIG } from "@/utils/config";
import { configManager, multiplyByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { Account as StarknetAccount } from "starknet";

const ALL_RESOURCE_IDS = Object.values(ResourcesIds).filter((value) => typeof value === "number") as ResourcesIds[];

export const PROCESS_INTERVAL_MS = 60 * 1000; // 1 minute
const CYCLE_BUFFER = 150;

export type AutomationEvent =
  | {
      type: "transfer-complete";
      order: AutomationOrder;
      resources: { resourceId: ResourcesIds; amount: number }[];
    }
  | {
      type: "production-complete";
      order: AutomationOrder;
      producedAmount: number;
    };

// System calls resolve to transaction receipts in practice; the processor only needs the promise
// to settle, so we accept any promise-like payload.
type SystemCallResult = Promise<unknown>;

interface BurnResourceForResourceProductionCall {
  (args: {
    signer: StarknetAccount;
    from_entity_id: number;
    production_cycles: number[];
    produced_resource_types: number[];
  }): SystemCallResult;
}

interface BurnLaborForResourceProductionCall {
  (args: {
    signer: StarknetAccount;
    from_entity_id: number;
    production_cycles: number[];
    produced_resource_types: number[];
  }): SystemCallResult;
}

interface BurnResourceForLaborProductionCall {
  (args: {
    signer: StarknetAccount;
    resource_types: number[];
    resource_amounts: number[];
    entity_id: number;
  }): SystemCallResult;
}

interface SendResourcesCall {
  (args: {
    signer: StarknetAccount;
    sender_entity_id: number;
    recipient_entity_id: number;
    resources: { resource: ResourcesIds; amount: number }[];
  }): SystemCallResult;
}

export interface AutomationProcessorParams {
  ordersByRealm: Record<string, AutomationOrder[]>;
  components: ClientComponents | null | undefined;
  signer: StarknetAccount | undefined;
  currentTick: number;
  isGloballyPaused: boolean;
  isRealmPaused: (realmEntityId: string) => boolean;
  systemCalls: {
    burnResourceForResourceProduction: BurnResourceForResourceProductionCall;
    burnLaborForResourceProduction: BurnLaborForResourceProductionCall;
    burnResourceForLaborProduction: BurnResourceForLaborProductionCall;
    sendResources: SendResourcesCall;
  };
  updateOrderProducedAmount: (realmEntityId: string, orderId: string, producedThisCycle: number) => void;
  updateTransferTimestamp: (realmEntityId: string, orderId: string) => void;
}

export async function processAutomationTick({
  ordersByRealm,
  components,
  signer,
  currentTick,
  isGloballyPaused,
  isRealmPaused,
  systemCalls,
  updateOrderProducedAmount,
  updateTransferTimestamp,
}: AutomationProcessorParams): Promise<AutomationEvent[]> {
  const events: AutomationEvent[] = [];

  if (isGloballyPaused) {
    console.log("Automation: Globally paused. Skipping all processing.");
    return events;
  }

  if (!signer || !signer.address || signer.address === "0x0") {
    console.warn("Automation: Missing Starknet signer. Skipping.");
    return events;
  }

  if (!components) {
    console.warn("Automation: Missing Dojo components. Skipping.");
    return events;
  }

  if (currentTick === 0) {
    console.warn("Automation: Current tick is 0. Skipping.");
    return events;
  }

  const realms = Object.keys(ordersByRealm);
  for (const realmEntityId of realms) {
    if (isRealmPaused(realmEntityId)) {
      console.log(`Automation: Realm ${realmEntityId} is paused. Skipping all orders.`);
      continue;
    }

    const realmOrders = [...(ordersByRealm[realmEntityId] || [])].sort((a, b) => a.priority - b.priority);
    if (!realmOrders.length) continue;

    console.log(`Automation: Processing ${realmOrders.length} orders for realm ${realmEntityId}.`);

    for (const order of realmOrders) {
      if (
        order.productionType !== ProductionType.Transfer &&
        order.mode === OrderMode.ProduceOnce &&
        order.maxAmount !== "infinite" &&
        order.producedAmount >= order.maxAmount
      ) {
        console.log(
          `Automation: Order ${order.id} for ${ResourcesIds[order.resourceToUse]} in realm ${realmEntityId} has reached its target. Skipping.`,
        );
        continue;
      }

      if (order.productionType === ProductionType.Transfer) {
        const transferEvent = await handleTransferOrder(order, {
          components,
          currentTick,
          signer,
          systemCalls,
          updateTransferTimestamp,
        });
        if (transferEvent) {
          events.push(transferEvent);
        }
        continue;
      }

      const productionEvent = await handleProductionOrder(order, {
        components,
        currentTick,
        signer,
        systemCalls,
        updateOrderProducedAmount,
      });

      if (productionEvent) {
        events.push(productionEvent);
      }
    }
  }

  return events;
}

interface TransferOrderContext {
  components: ClientComponents;
  currentTick: number;
  signer: StarknetAccount;
  systemCalls: AutomationProcessorParams["systemCalls"];
  updateTransferTimestamp: AutomationProcessorParams["updateTransferTimestamp"];
}

async function handleTransferOrder(
  order: AutomationOrder,
  { components, currentTick, signer, systemCalls, updateTransferTimestamp }: TransferOrderContext,
): Promise<AutomationEvent | null> {
  try {
    if (!order.transferMode) return null;

    let shouldTransfer = false;

    if (order.transferMode === TransferMode.Recurring) {
      const now = Date.now();
      const lastTransfer = order.lastTransferTimestamp || 0;
      const intervalMs = (order.transferInterval || 60) * 60 * 1000;
      shouldTransfer = now - lastTransfer >= intervalMs;
      if (!shouldTransfer) {
        console.log(
          `Automation: Transfer order ${order.id} not due yet. Next transfer in ${Math.ceil((intervalMs - (now - lastTransfer)) / 1000 / 60)} minutes.`,
        );
        return null;
      }
    } else if (
      order.transferMode === TransferMode.MaintainStock ||
      order.transferMode === TransferMode.DepletionTransfer
    ) {
      const targetBalances = await fetchBalances(currentTick, order.targetEntityId!, components);
      const sourceBalances = await fetchBalances(currentTick, order.realmEntityId, components);

      const triggerResource = order.transferResources?.[0];
      if (triggerResource) {
        if (order.transferMode === TransferMode.MaintainStock) {
          const targetBalance = targetBalances[triggerResource.resourceId] || 0;
          shouldTransfer = targetBalance < multiplyByPrecision(order.transferThreshold || 0);
        } else {
          const sourceBalance = sourceBalances[triggerResource.resourceId] || 0;
          shouldTransfer = sourceBalance > multiplyByPrecision(order.transferThreshold || 0);
        }
      }

      if (!shouldTransfer) {
        return null;
      }
    }

    if (!shouldTransfer) {
      return null;
    }

    const sourceBalances = await fetchBalances(currentTick, order.realmEntityId, components);
    const resourcesToTransfer: { resource: ResourcesIds; amount: number }[] = [];

    for (const resource of order.transferResources || []) {
      const requiredAmount = multiplyByPrecision(resource.amount);
      const availableAmount = sourceBalances[resource.resourceId] || 0;

      if (availableAmount < requiredAmount) {
        console.warn(
          `Automation: Not enough ${ResourcesIds[resource.resourceId]} for transfer. Required: ${requiredAmount}, Available: ${availableAmount}.`,
        );
        return null;
      }

      resourcesToTransfer.push({
        resource: resource.resourceId,
        amount: requiredAmount,
      });
    }

    if (!resourcesToTransfer.length) {
      console.warn(`Automation: Transfer order ${order.id} has no resources to transfer.`);
      return null;
    }

    await systemCalls.sendResources({
      signer,
      sender_entity_id: Number(order.realmEntityId),
      recipient_entity_id: Number(order.targetEntityId),
      resources: resourcesToTransfer,
    });

    console.log(
      `Automation: Executed transfer from ${order.realmName} to ${order.targetEntityName}.`,
      resourcesToTransfer,
    );

    if (order.transferMode === TransferMode.Recurring) {
      updateTransferTimestamp(order.realmEntityId, order.id);
      console.log(`Automation: Updated last transfer timestamp for order ${order.id}`);
    }

    return {
      type: "transfer-complete",
      order,
      resources: order.transferResources || [],
    };
  } catch (error) {
    console.error(`Automation: Error processing transfer order ${order.id}:`, error);
    return null;
  }
}

interface ProductionOrderContext {
  components: ClientComponents;
  currentTick: number;
  signer: StarknetAccount;
  systemCalls: AutomationProcessorParams["systemCalls"];
  updateOrderProducedAmount: AutomationProcessorParams["updateOrderProducedAmount"];
}

async function handleProductionOrder(
  order: AutomationOrder,
  { components, currentTick, signer, systemCalls, updateOrderProducedAmount }: ProductionOrderContext,
): Promise<AutomationEvent | null> {
  try {
    const currentBalances = await fetchBalances(currentTick, order.realmEntityId, components);
    const recipe = getProductionRecipe(order.resourceToUse, order.productionType);

    console.log(
      `Automation: Recipe for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}:`,
      recipe,
    );

    if (!recipe || recipe.outputAmount === 0) {
      console.warn(
        `Automation: No valid recipe or zero output for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}, order ${order.id}.`,
      );
      return null;
    }

    if (order.mode === OrderMode.MaintainBalance) {
      const targetBalance = order.maxAmount as number;
      const resourceToMaintain =
        order.productionType === ProductionType.ResourceToLabor ? ResourcesIds.Labor : order.resourceToUse;

      const projectedBalance = await getProjectedBalance(
        currentTick,
        order.realmEntityId,
        resourceToMaintain,
        components,
      );
      const targetBalanceInPrecision = multiplyByPrecision(targetBalance);
      const bufferPercentage = order.bufferPercentage || 10;
      const bufferAmount = targetBalanceInPrecision * (bufferPercentage / 100);
      const triggerBalance = targetBalanceInPrecision - bufferAmount;

      if (projectedBalance >= triggerBalance) {
        console.log(
          `Automation: Projected balance for ${ResourcesIds[resourceToMaintain]} is sufficient (${projectedBalance} >= ${triggerBalance}). Skipping.`,
        );
        return null;
      }
    }

    const insufficiency = recipe.inputs.some((input) => {
      if (input.amount <= 0) return false;
      const balance = currentBalances[input.resourceId] || 0;
      if (balance < multiplyByPrecision(input.amount)) {
        console.warn(
          `Automation: Insufficient balance for ${ResourcesIds[input.resourceId]} in realm ${order.realmEntityId}, order ${order.id}. Required ${multiplyByPrecision(input.amount)}, available ${balance}. Skipping.`,
        );
        return true;
      }
      return false;
    });

    if (insufficiency) {
      return null;
    }

    let maxPossibleCycles = recipe.inputs.length
      ? Math.min(
          ...recipe.inputs
            .filter((input) => input.amount > 0)
            .map((input) => {
              const balance = currentBalances[input.resourceId] || 0;
              return Math.floor(balance / multiplyByPrecision(input.amount));
            }),
        )
      : 10000;

    maxPossibleCycles = Math.max(1, maxPossibleCycles - CYCLE_BUFFER);

    if (!Number.isFinite(maxPossibleCycles) || maxPossibleCycles <= 0) {
      return null;
    }

    let cyclesToRun = maxPossibleCycles;

    if (order.mode === OrderMode.ProduceOnce && order.maxAmount !== "infinite") {
      const remainingAmountToProduce = order.maxAmount - order.producedAmount;
      if (remainingAmountToProduce <= 0) {
        return null;
      }
      const cyclesForRemainingAmount = Math.ceil(remainingAmountToProduce / recipe.outputAmount);
      cyclesToRun = Math.min(cyclesToRun, cyclesForRemainingAmount);
    }

    if (order.mode === OrderMode.MaintainBalance) {
      const targetBalance = order.maxAmount as number;
      const resourceToMaintain =
        order.productionType === ProductionType.ResourceToLabor ? ResourcesIds.Labor : order.resourceToUse;
      const projectedBalance = await getProjectedBalance(
        currentTick,
        order.realmEntityId,
        resourceToMaintain,
        components,
      );
      const targetBalanceInPrecision = multiplyByPrecision(targetBalance);
      const amountNeeded = targetBalanceInPrecision - projectedBalance;
      if (amountNeeded <= 0) {
        return null;
      }
      const outputAmountInPrecision = multiplyByPrecision(recipe.outputAmount);
      const cyclesForTargetAmount = Math.ceil(amountNeeded / outputAmountInPrecision);
      cyclesToRun = Math.min(cyclesToRun, cyclesForTargetAmount);
    }

    if (cyclesToRun <= 0) {
      return null;
    }

    const realmIdNumberForSyscall = Number(order.realmEntityId);
    if (Number.isNaN(realmIdNumberForSyscall)) {
      console.error(`Automation: Invalid realmEntityId for syscall in order ${order.id}: ${order.realmEntityId}`);
      return null;
    }

    let producedThisCycle = 0;

    if (order.productionType === ProductionType.ResourceToResource) {
      const calldata = {
        signer,
        from_entity_id: realmIdNumberForSyscall,
        production_cycles: [cyclesToRun],
        produced_resource_types: [order.resourceToUse],
      };
      await systemCalls.burnResourceForResourceProduction(calldata);
      producedThisCycle = cyclesToRun * recipe.outputAmount;
    } else if (order.productionType === ProductionType.LaborToResource) {
      const calldata = {
        signer,
        from_entity_id: realmIdNumberForSyscall,
        production_cycles: [cyclesToRun],
        produced_resource_types: [order.resourceToUse],
      };
      await systemCalls.burnLaborForResourceProduction(calldata);
      producedThisCycle = cyclesToRun * recipe.outputAmount;
    } else if (order.productionType === ProductionType.ResourceToLabor) {
      const inputAmount = recipe.inputs[0].amount;
      const totalToSpend = cyclesToRun * inputAmount;
      const calldata = {
        signer,
        resource_types: [order.resourceToUse],
        resource_amounts: [multiplyByPrecision(totalToSpend)],
        entity_id: realmIdNumberForSyscall,
      };
      await systemCalls.burnResourceForLaborProduction(calldata);
      producedThisCycle = cyclesToRun * recipe.outputAmount;
    }

    if (!producedThisCycle) {
      return null;
    }

    updateOrderProducedAmount(order.realmEntityId, order.id, producedThisCycle);

    console.log(
      `Automation: Produced ${producedThisCycle} of ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId} for order ${order.id}.`,
    );

    return {
      type: "production-complete",
      order,
      producedAmount: producedThisCycle,
    };
  } catch (error) {
    console.error(
      `Automation: Error processing order ${order.id} for ${ResourcesIds[order.resourceToUse]} in realm ${order.realmEntityId}:`,
      error,
    );
    return null;
  }
}

async function fetchBalances(
  tick: number,
  realmEntityId: string,
  dojoComponents: ClientComponents,
): Promise<Record<number, number>> {
  const balances: Record<number, number> = {};
  try {
    const realmIdNumber = Number(realmEntityId);
    if (Number.isNaN(realmIdNumber)) {
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

async function getProjectedBalance(
  tick: number,
  realmEntityId: string,
  resourceId: ResourcesIds,
  dojoComponents: ClientComponents,
): Promise<number> {
  try {
    const realmIdNumber = Number(realmEntityId);
    if (Number.isNaN(realmIdNumber)) {
      console.error(`Invalid realmEntityId for getProjectedBalance: ${realmEntityId}`);
      return 0;
    }
    const manager = new ResourceManager(dojoComponents, realmIdNumber);

    const ticksUntilProductionEnds = manager.timeUntilValueReached(tick, resourceId);

    if (ticksUntilProductionEnds === 0) {
      const currentBalance = manager.balanceWithProduction(tick, resourceId);
      return currentBalance.balance;
    }

    const futureBalance = manager.balanceWithProduction(tick + ticksUntilProductionEnds, resourceId);

    console.log(
      `Automation: Projected balance for ${ResourcesIds[resourceId]} after ${ticksUntilProductionEnds} ticks: ${futureBalance.balance}.`,
    );

    return futureBalance.balance;
  } catch (error) {
    console.error(`Error getting projected balance for resource ${resourceId}:`, error);
    return 0;
  }
}

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
