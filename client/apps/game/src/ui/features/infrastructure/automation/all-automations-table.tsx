import {
  AutomationOrder,
  OrderMode,
  ProductionType,
  TransferMode,
  useAutomationStore,
} from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionModal } from "@/ui/features/settlement";
import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";
import { ArrowRightIcon, CheckIcon, PauseIcon, PlayIcon, TrashIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

const eternumConfig = ETERNUM_CONFIG();

// Helper function to format minutes into a human-readable string
function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

export const AllAutomationsTable: React.FC = () => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);
  const removeOrder = useAutomationStore((state) => state.removeOrder);
  const removeAllOrders = useAutomationStore((state) => state.removeAllOrders);
  const nextRunTimestamp = useAutomationStore((state) => state.nextRunTimestamp);
  const toggleRealmPause = useAutomationStore((state) => state.toggleRealmPause);
  const isRealmPaused = useAutomationStore((state) => state.isRealmPaused);
  const isGloballyPaused = useAutomationStore((state) => state.isGloballyPaused);
  const toggleGlobalPause = useAutomationStore((state) => state.toggleGlobalPause);

  // Realm filter state
  const [realmFilter, setRealmFilter] = useState<string>("all");
  const [countdown, setCountdown] = useState<string>("--:--");

  // Effect for countdown timer
  useEffect(() => {
    if (nextRunTimestamp === null) {
      setCountdown("Calculating...");
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, nextRunTimestamp - now);
      const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
      const seconds = Math.floor((timeLeft / 1000) % 60);
      setCountdown(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    const timerId = setInterval(updateCountdown, 1000);

    return () => clearInterval(timerId);
  }, [nextRunTimestamp]);

  // Reset filter if the selected realm no longer exists
  useEffect(() => {
    if (realmFilter === "all") return;
    const realmStillExists = Object.keys(ordersByRealm).some((id) => id.toString() === realmFilter);
    if (!realmStillExists) {
      setRealmFilter("all");
    }
  }, [ordersByRealm, realmFilter]);

  // Flatten all orders from all realms into a single list and sort them.
  const allOrders = useMemo(() => {
    const list: AutomationOrder[] = [];
    Object.values(ordersByRealm).forEach((orders) => {
      list.push(...orders);
    });
    // Sort by realm (numeric) and then by priority
    return list.sort((a, b) => {
      if (a.realmEntityId !== b.realmEntityId) {
        return Number(a.realmEntityId) - Number(b.realmEntityId);
      }
      return a.priority - b.priority;
    });
  }, [ordersByRealm]);

  // Unique realm ids and names for the dropdown
  const realmOptions = useMemo(() => {
    const map: Record<string, string> = {};
    allOrders.forEach((o) => {
      map[o.realmEntityId] = o.realmName ?? o.realmEntityId.toString();
    });
    return Object.entries(map)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([id, name]) => ({ id, name }));
  }, [allOrders]);

  // Apply filter
  const displayedOrders = useMemo(() => {
    if (realmFilter === "all") return allOrders;
    return allOrders.filter((o) => o.realmEntityId.toString() === realmFilter);
  }, [allOrders, realmFilter]);

  if (allOrders.length === 0) {
    return (
      <div className="   justify-center items-center h-full">
        <p className="text-sm mb-2">No automations found. Add one to get started.</p>
        <Button onClick={() => toggleModal(<ProductionModal />)}>Add Automation</Button>
      </div>
    );
  }

  return (
    <div className=" ">
      <h4 className="mb-2 font-bold">Automation</h4>

      <Button className="mb-2" size="xs" onClick={() => toggleModal(<ProductionModal />)}>
        Add Automation
      </Button>

      {/* Global Pause Button */}
      <Button
        className={`mb-2 ml-2 ${isGloballyPaused ? "hover:bg-dark-green-accent" : "hover:bg-danger"}`}
        size="xs"
        onClick={toggleGlobalPause}
        title={isGloballyPaused ? "Resume all automation" : "Pause all automation"}
      >
        {isGloballyPaused ? (
          <>
            <PlayIcon className="w-4 h-4 mr-1" />
            Resume All
          </>
        ) : (
          <>
            <PauseIcon className="w-4 h-4 mr-1" />
            Pause All
          </>
        )}
      </Button>

      {/* Display Countdown Timer */}
      <div className="mb-2 text-xs ">
        {isGloballyPaused ? "All automation paused" : `Next automation run in: ${countdown}`}
      </div>

      {/* Realm filter */}
      <div className="mb-4 flex items-center text-sm space-x-2">
        <Select value={realmFilter} onValueChange={(value) => setRealmFilter(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {realmOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="xs"
          onClick={() => removeAllOrders(realmFilter)}
          variant="danger"
          disabled={displayedOrders.length === 0}
        >
          Delete All
        </Button>
      </div>

      <table className="w-full text-sm text-left table-auto">
        <thead className="text-xs uppercase bg-gray-700/50 text-gold">
          <tr>
            <th scope="col" className="px-6">
              Order
            </th>
            <th scope="col" className="px-6">
              Progress / Target
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedOrders.map((order) => {
            const isFinished =
              order.mode === OrderMode.ProduceOnce &&
              order.maxAmount !== "infinite" &&
              order.producedAmount >= order.maxAmount;
            const isPaused = isRealmPaused(order.realmEntityId);
            const isEffectivelyPaused = isGloballyPaused || isPaused;
            return (
              <tr
                key={order.id}
                className={`border-b border-gold/10 hover:bg-gray-600/30 ${isFinished ? "bg-green-700/40" : ""} ${isEffectivelyPaused ? "opacity-50" : ""}`}
              >
                <td className=" py-4">
                  {order.productionType === ProductionType.Transfer ? (
                    <div className="text-xs mb-2 font-bold text-green">Transfer</div>
                  ) : (
                    <div
                      className={`text-xs mb-2 font-bold ${order.mode === OrderMode.MaintainBalance ? "text-green" : "text-blue"}`}
                    >
                      {order.mode === OrderMode.MaintainBalance ? "Maintain" : "Once"}
                    </div>
                  )}

                  <div className="text-xs bg-gold/20 px-2 py-1 rounded border border-gold/30">
                    <div className="h4 flex items-center gap-2">
                      {order.realmName ?? order.realmEntityId}
                      {isGloballyPaused && <span className="text-red text-xs">(ALL PAUSED)</span>}
                      {!isGloballyPaused && isPaused && <span className="text-red text-xs">(PAUSED)</span>}
                    </div>
                    <div className="font-bold">Priority {order.priority}</div>

                    {order.productionType === ProductionType.Transfer ? (
                      <div className="text-xs">
                        Transfer: {order.transferMode === TransferMode.Recurring && "Recurring"}
                        {order.transferMode === TransferMode.MaintainStock && "Maintain Stock"}
                        {order.transferMode === TransferMode.DepletionTransfer && "Depletion"}
                      </div>
                    ) : order.productionType === ProductionType.ResourceToLabor ? (
                      "Resource To Labor"
                    ) : order.productionType === ProductionType.ResourceToResource ? (
                      "Resource To Resource"
                    ) : order.productionType === ProductionType.LaborToResource ? (
                      "Labor To Resource"
                    ) : (
                      order.productionType
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 text-lg">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      {order.productionType === ProductionType.Transfer ? (
                        <>
                          <span className="text-sm mr-1">{order.realmName}</span>
                          <ArrowRightIcon className="w-4 h-4 mx-2" />
                          <span className="text-sm ml-1">{order.targetEntityName || order.targetEntityId}</span>
                        </>
                      ) : order.productionType === ProductionType.ResourceToLabor ? (
                        <>
                          <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" className="mr-2" />
                          <span className="mx-1">→</span>
                          <ResourceIcon resource={"Labor"} size="sm" className="" />
                        </>
                      ) : order.productionType === ProductionType.LaborToResource ? (
                        <>
                          <ResourceIcon resource={"Labor"} size="sm" className="" />
                          <span className="mx-1">→</span>
                          <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" className="mr-2" />
                        </>
                      ) : (
                        <>
                          {eternumConfig.resources.productionByComplexRecipe[order.resourceToUse].map((recipe) => (
                            <ResourceIcon
                              key={recipe.resource}
                              resource={ResourcesIds[recipe.resource]}
                              size="sm"
                              className=""
                            />
                          ))}
                          <span className="mx-1">→</span>
                          <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" className="mr-2" />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs">
                    {order.productionType === ProductionType.Transfer ? (
                      <div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {order.transferResources?.map((res, idx) => (
                            <div key={idx} className="flex items-center bg-gold/10 px-1 py-0.5 rounded">
                              <ResourceIcon resource={ResourcesIds[res.resourceId]} size="xs" className="mr-1" />
                              <span className="text-xs">{res.amount}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gold/50">
                          {order.transferMode === TransferMode.Recurring &&
                            `Every ${formatMinutes(order.transferInterval || 60)}`}
                          {order.transferMode === TransferMode.MaintainStock &&
                            `When dest < ${order.transferThreshold?.toLocaleString()}`}
                          {order.transferMode === TransferMode.DepletionTransfer &&
                            `When source > ${order.transferThreshold?.toLocaleString()}`}
                        </div>
                      </div>
                    ) : order.mode === OrderMode.ProduceOnce ? (
                      <div>
                        {order.producedAmount.toLocaleString()} /{" "}
                        {order.maxAmount === "infinite" ? "∞" : order.maxAmount.toLocaleString()}{" "}
                        {order.maxAmount !== "infinite" && order.maxAmount > 0 && (
                          <span className="text-xs ">
                            ({Math.floor((order.producedAmount / order.maxAmount) * 100)}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        Target: {order.maxAmount.toLocaleString()}
                        <br />
                        {order.productionType === ProductionType.ResourceToLabor && (
                          <span className="text-xs text-gold/50"> Labor</span>
                        )}
                        {order.bufferPercentage && (
                          <span className="text-xs "> (Buffer: {order.bufferPercentage}%)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => toggleRealmPause(order.realmEntityId)}
                      variant="outline"
                      size="xs"
                      disabled={isGloballyPaused}
                      title={
                        isGloballyPaused
                          ? "Global pause is active - resume all automation first"
                          : isPaused
                            ? "Resume automation for this realm"
                            : "Pause automation for this realm"
                      }
                    >
                      {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={() => removeOrder(order.realmEntityId, order.id)}
                      variant="danger"
                      size="xs"
                      title={isFinished ? "Order completed - click to remove" : "Remove order"}
                    >
                      {isFinished ? <CheckIcon className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
