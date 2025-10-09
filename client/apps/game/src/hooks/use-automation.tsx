import { ProductionType, useAutomationStore } from "@/hooks/store/use-automation-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import {
  AutomationEvent,
  PROCESS_INTERVAL_MS,
  processAutomationTick,
} from "@/ui/features/infrastructure/automation/model/automation-processor";
import { useDojo } from "@bibliothecadao/react";
import { ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Account as StarknetAccount } from "starknet";
import { useBlockTimestamp } from "./helpers/use-block-timestamp";

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
  const isGloballyPaused = useAutomationStore((state) => state.isGloballyPaused);
  const cleanupStaleOrders = useAutomationStore((state) => state.cleanupStaleOrders);
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

  useEffect(() => {
    const removed = cleanupStaleOrders();
    if (removed > 0) {
      console.info(`Automation: Cleared ${removed} stale automation order${removed === 1 ? "" : "s"}.`);
    }
  }, [cleanupStaleOrders]);

  const emitAutomationEvents = useCallback((events: AutomationEvent[]) => {
    events.forEach((event) => {
      if (event.type === "transfer-complete") {
        const { order, resources } = event;
        toast.success(
          <div className="flex flex-col">
            <span className="font-bold">Automation: Transfer Completed</span>
            <span className="text-sm">
              From {order.realmName} to {order.targetEntityName || order.targetEntityId}
            </span>
            <div className="flex gap-2 mt-1">
              {resources?.map((res, idx) => (
                <div key={`${order.id}-transfer-${idx}`} className="flex items-center">
                  <ResourceIcon resource={ResourcesIds[res.resourceId]} size="xs" className="mr-1" />
                  <span className="text-xs">{res.amount}</span>
                </div>
              ))}
            </div>
          </div>,
        );
        return;
      }

      if (event.type === "production-complete") {
        const { order, producedAmount } = event;
        const producedResourceName =
          order.productionType === ProductionType.ResourceToLabor ? "Labor" : ResourcesIds[order.resourceToUse];

        if (order.productionType === ProductionType.ResourceToLabor) {
          toast.success(
            <div className="flex">
              <ResourceIcon className="inline-block" resource={ResourcesIds[order.resourceToUse]} size="sm" />
              <span className="ml-2">
                Automation: Resource To Labor. Produced {producedAmount.toLocaleString()} labor from{" "}
                {ResourcesIds[order.resourceToUse]} on realm {order.realmName ?? order.realmEntityId}.
              </span>
            </div>,
          );
          return;
        }

        toast.success(
          <div className="flex">
            <ResourceIcon className="inline-block" resource={ResourcesIds[order.resourceToUse]} size="sm" />
            <span className="ml-2">
              Automation:{" "}
              {order.productionType === ProductionType.ResourceToResource
                ? "Resource To Resource"
                : "Labor To Resource"}
              . Produced {producedAmount.toLocaleString()} of {producedResourceName} on{" "}
              {order.realmName ?? order.realmEntityId}.
            </span>
          </div>,
        );
      }
    });
  }, []);

  const processOrders = useCallback(async (): Promise<boolean> => {
    if (processingRef.current) return false;

    if (!starknetSignerAccount || !starknetSignerAccount.address || starknetSignerAccount.address === "0x0") {
      console.warn("Automation: Missing Starknet signer. Skipping.");
      return false;
    }

    if (!components) {
      console.warn("Automation: Missing Dojo components. Skipping.");
      return false;
    }

    if (currentTickRef.current === 0) {
      console.warn("Automation: Current tick is 0. Skipping.");
      return false;
    }

    if (isGloballyPaused) {
      console.log("Automation: Globally paused. Skipping all processing.");
      return false;
    }

    processingRef.current = true;
    let didProcess = false;

    try {
      const removed = cleanupStaleOrders();
      if (removed > 0) {
        ordersByRealmRef.current = useAutomationStore.getState().ordersByRealm;
        console.info(`Automation: Skipped ${removed} expired automation order${removed === 1 ? "" : "s"}.`);
      }

      const events = await processAutomationTick({
        ordersByRealm: ordersByRealmRef.current,
        components,
        signer: starknetSignerAccount as StarknetAccount,
        currentTick: currentTickRef.current,
        isGloballyPaused,
        isRealmPaused,
        systemCalls: {
          burnResourceForResourceProduction: burn_resource_for_resource_production,
          burnLaborForResourceProduction: burn_labor_for_resource_production,
          burnResourceForLaborProduction: burn_resource_for_labor_production,
          sendResources: send_resources,
        },
        updateOrderProducedAmount,
        updateTransferTimestamp,
      });

      didProcess = true;
      emitAutomationEvents(events);
    } catch (error) {
      console.error("Automation: Unhandled error while processing orders:", error);
    } finally {
      processingRef.current = false;
    }

    return didProcess;
  }, [
    burn_labor_for_resource_production,
    burn_resource_for_labor_production,
    burn_resource_for_resource_production,
    cleanupStaleOrders,
    components,
    emitAutomationEvents,
    isGloballyPaused,
    isRealmPaused,
    send_resources,
    starknetSignerAccount,
    updateOrderProducedAmount,
    updateTransferTimestamp,
  ]);

  // Setup the automation interval as soon as the hook mounts. The `processOrders` function
  // contains its own early-exit checks, so we don't need to guard here – this ensures the
  // interval is created immediately and will start working as soon as the required data is
  // available.
  useEffect(() => {
    const runAndSchedule = async () => {
      const processed = await processOrders();
      if (processed) {
        setNextRunTimestamp(Date.now() + PROCESS_INTERVAL_MS);
      }
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
