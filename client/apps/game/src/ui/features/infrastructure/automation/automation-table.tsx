import {
  AutomationOrder,
  OrderMode,
  ProductionType,
  TransferMode,
  useAutomationStore,
} from "@/hooks/store/use-automation-store";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { ETERNUM_CONFIG } from "@/utils/config";
import { getStructureName } from "@bibliothecadao/eternum";
import { RealmInfo, resources, ResourcesIds } from "@bibliothecadao/types";
import { LucideArrowRight } from "lucide-react";
import React, { useMemo, useState } from "react";

interface AutomationTableProps {
  realmEntityId: string;
  realmInfo: RealmInfo;
  availableResources: ResourcesIds[];
}
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

// Global list of all possible resource IDs and their names
const allPossibleResourceIds = Object.entries(ResourcesIds)
  .filter(([key, value]) => typeof value === "number")
  .map(([key, value]) => ({ name: key, id: value as ResourcesIds }));

export const AutomationTable: React.FC<AutomationTableProps> = ({ realmEntityId, realmInfo, availableResources }) => {
  // Filter resources based on what's available in the current realmInfo
  const availableResourcesForRealm = useMemo(() => {
    if (!realmInfo || !realmInfo.resources) return [];
    return allPossibleResourceIds
      .filter((res) => availableResources.includes(res.id))
      .filter((res) => res.id !== ResourcesIds.Fish && res.id !== ResourcesIds.Wheat);
  }, [realmInfo, availableResources]);

  const ordersForRealm = useAutomationStore((state) => state.getOrdersForRealm(realmEntityId));
  const addOrder = useAutomationStore((state) => state.addOrder);
  const removeOrder = useAutomationStore((state) => state.removeOrder);
  const toggleRealmPause = useAutomationStore((state) => state.toggleRealmPause);
  const isRealmPaused = useAutomationStore((state) => state.isRealmPaused(realmEntityId));

  const [showAddForm, setShowAddForm] = useState(false);
  const [newOrder, setNewOrder] = useState<Omit<AutomationOrder, "id" | "producedAmount" | "realmEntityId">>(() => ({
    priority: 5,
    resourceToUse: availableResourcesForRealm[0]?.id,
    mode: OrderMode.ProduceOnce,
    maxAmount: 1000,
    productionType: ProductionType.ResourceToResource,
    realmName: getStructureName(realmInfo.structure).name,
    bufferPercentage: 10,
  }));
  const [maxAmountInput, setMaxAmountInput] = useState<string>("5000");
  const [isInfinite, setIsInfinite] = useState(false);

  // Filter resources for the select based on productionType
  const filteredResourcesForSelect = useMemo(() => {
    // Hide Labor from the resource select for all production types
    return availableResourcesForRealm.filter((res) => res.id !== ResourcesIds.Labor);
  }, [availableResourcesForRealm]);

  const filteredResourcesForLaborInput = useMemo(() => {
    return resources
      .filter((res) => res.id <= ResourcesIds.Dragonhide)
      .map((res) => ({
        id: res.id,
        name: res.trait,
      }));
  }, []);

  // Effect to update default resource if realmInfo (and thus availableResourcesForRealm) changes
  React.useEffect(() => {
    setNewOrder({
      priority: 5,
      resourceToUse: filteredResourcesForSelect[0]?.id,
      mode: OrderMode.ProduceOnce,
      maxAmount: 1000,
      productionType: ProductionType.ResourceToResource,
      realmName: getStructureName(realmInfo.structure).name,
      bufferPercentage: 10,
    });
    setMaxAmountInput("1000");
    setIsInfinite(false);
  }, [filteredResourcesForSelect, realmInfo, realmEntityId]);

  if (!realmEntityId || !realmInfo) {
    return <p>Realm data not available.</p>;
  }

  const handleRemoveOrder = (orderId: string) => {
    removeOrder(realmEntityId, orderId);
  };

  const handleResourceChange = (value: string) => {
    const parsedValue = parseInt(value, 10);
    if (!isNaN(parsedValue)) {
      setNewOrder((prev) => ({
        ...prev,
        resourceToUse: parsedValue as ResourcesIds,
      }));
    }
  };

  const handleProductionTypeChange = (value: ProductionType) => {
    const newResourceToUse =
      value === ProductionType.ResourceToLabor
        ? filteredResourcesForLaborInput[0]?.id
        : filteredResourcesForSelect[0]?.id;

    setNewOrder((prev) => ({
      ...prev,
      productionType: value,
      resourceToUse: newResourceToUse,
    }));
  };

  const handleMaxAmountChange = (value: string) => {
    setMaxAmountInput(value);
    if (!isInfinite) {
      const numValue = parseInt(value, 10);
      setNewOrder((prev) => ({ ...prev, maxAmount: isNaN(numValue) ? 0 : numValue }));
    }
  };

  const toggleInfinite = () => {
    setIsInfinite((prev) => {
      const nextIsInfinite = !prev;
      if (nextIsInfinite) {
        setNewOrder((prevOrder) => ({ ...prevOrder, maxAmount: "infinite" }));
      } else {
        const numValue = parseInt(maxAmountInput, 10);
        setNewOrder((prevOrder) => ({ ...prevOrder, maxAmount: isNaN(numValue) || numValue < 0 ? 0 : numValue }));
      }
      return nextIsInfinite;
    });
  };

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrder.resourceToUse === undefined) {
      alert("Please select a valid resource to produce for this realm.");
      return;
    }
    if (newOrder.maxAmount !== "infinite" && newOrder.maxAmount <= 0 && !isInfinite) {
      alert("Target amount must be greater than 0, or set to infinite.");
      return;
    }
    // If resource is Labor, laborResourceId must be set
    if (
      newOrder.productionType === ProductionType.ResourceToResource &&
      newOrder.resourceToUse === ResourcesIds.Labor
    ) {
      alert("Please select a labor resource.");
      return;
    }
    addOrder({ ...newOrder, realmEntityId });
    setShowAddForm(false);
    setNewOrder({
      priority: 5,
      resourceToUse: availableResourcesForRealm[0]?.id,
      mode: OrderMode.ProduceOnce,
      maxAmount: 1000,
      productionType: ProductionType.ResourceToResource,
      realmName: getStructureName(realmInfo.structure).name,
      bufferPercentage: 10,
    });
    setMaxAmountInput("1000");
    setIsInfinite(false);
  };

  return (
    <div className="p-2 border rounded-lg shadow-md panel-wood">
      <div className="text-red/90 bg-red/10 rounded-md px-2 mb-2 text-xs border border-red/20">
        IMPORTANT: Your browser must stay open for automation. Automation runs every 10 minutes.
        <br />
      </div>
      <h4 className="mb-2">
        [BETA] Automation for Realm {getStructureName(realmInfo.structure).name} ({realmEntityId})
      </h4>

      {/* Add pause checkbox */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-black/20 rounded">
        <input
          type="checkbox"
          id={`pause-realm-${realmEntityId}`}
          checked={isRealmPaused}
          onChange={() => toggleRealmPause(realmEntityId)}
          className="w-4 h-4"
        />
        <label htmlFor={`pause-realm-${realmEntityId}`} className="text-sm font-medium">
          Pause all automation for this realm
        </label>
        {isRealmPaused && <span className="text-red ml-2 text-xs">(PAUSED - No orders will run)</span>}
      </div>

      <ul className="list-disc pl-4">
        <li>
          <span className="font-bold">Produce Once:</span> Automation will produce resources until the target amount is
          reached, then stop.
        </li>
        <li>
          <span className="font-bold">Maintain Balance:</span> Automation will keep resource balance at the target
          level. Production triggers when balance drops below target minus buffer percentage.
        </li>
        <li>Resources produced will increase your realm's balance and may cause resource loss if storage is full.</li>
        <li>
          Process activates every <span className="font-bold">10 minutes</span> automatically.
        </li>
      </ul>

      <div className="my-4">
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} variant="default" size="xs" disabled={isRealmPaused}>
            Add New Automation {isRealmPaused && "(Paused)"}
          </Button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddOrder} className="p-4 mb-6 space-y-4 border  border-gold/20 rounded-md bg-black/10">
          <h3 className="text-lg font-semibold">Create New Order</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="orderMode" className="block mb-1 text-sm font-medium">
                Order Mode:
              </label>
              <Select
                value={newOrder.mode}
                onValueChange={(value: OrderMode) => setNewOrder((prev) => ({ ...prev, mode: value }))}
              >
                <SelectTrigger className="w-full border border-gold/20 rounded-md">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OrderMode.ProduceOnce}>Produce Once</SelectItem>
                  <SelectItem value={OrderMode.MaintainBalance}>Maintain Balance</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gold/50 mb-1">
                {newOrder.mode === OrderMode.ProduceOnce
                  ? "Produce up to target amount then stop"
                  : "Keep resource balance at target level"}
              </div>
            </div>
            <div>
              <label htmlFor="productionType" className="block mb-1 text-sm font-medium">
                Production Type:
              </label>

              <Select value={newOrder.productionType} onValueChange={handleProductionTypeChange}>
                <SelectTrigger className="w-full border border-gold/20 rounded-md">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ProductionType.ResourceToResource}>Standard (Resource-based)</SelectItem>
                  <SelectItem value={ProductionType.LaborToResource}>Simple (Labor-based)</SelectItem>
                  <SelectItem value={ProductionType.ResourceToLabor}>Resource to Labor</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gold/50 mb-1">Choose how automation will convert resources.</div>
            </div>
            <div>
              <label htmlFor="priority" className="block mb-1 text-sm font-medium">
                Priority (1-9):
              </label>

              <NumberInput
                value={newOrder.priority}
                onChange={(val) => setNewOrder((prev) => ({ ...prev, priority: val }))}
                min={1}
                max={9}
                className="w-full"
              />
              <p className="text-xs text-gold/50 mt-1">
                Orders with lower numbers are executed first. 1 is the highest priority, 9 is the lowest.
              </p>
            </div>
            <div>
              <label htmlFor="resourceToUse" className="block mb-1 text-sm font-medium">
                {newOrder.productionType === ProductionType.ResourceToLabor
                  ? "Resource Input For Labor:"
                  : "Resource to Produce:"}
              </label>
              <Select value={String(newOrder.resourceToUse)} onValueChange={handleResourceChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {newOrder.productionType === ProductionType.ResourceToLabor ? (
                    filteredResourcesForLaborInput.map((res) => (
                      <SelectItem key={res.id} value={String(res.id)}>
                        <div className="flex items-center">
                          <ResourceIcon resource={res.name} size="xs" className="mr-2" />
                          {res.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : filteredResourcesForSelect.length > 0 ? (
                    filteredResourcesForSelect.map((res) => (
                      <SelectItem key={res.id} value={String(res.id)}>
                        <div className="flex items-center">
                          <ResourceIcon resource={res.name} size="xs" className="mr-2" />
                          {res.name}

                          {newOrder.productionType === ProductionType.ResourceToResource &&
                            eternumConfig.resources.productionByComplexRecipe[res.id].map((recipe) => (
                              <ResourceIcon resource={ResourcesIds[recipe.resource]} size="xs" className="ml-1" />
                            ))}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-resources" disabled>
                      No resources available for this realm to automate.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gold/50 mt-1">
                Select the resource you want this automation to produce (or use as input for labor).
              </p>
            </div>

            <div>
              <label htmlFor="maxAmount" className="block mb-1 text-sm font-medium">
                {newOrder.mode === OrderMode.MaintainBalance
                  ? newOrder.productionType === ProductionType.ResourceToLabor
                    ? "Target Labor Balance:"
                    : "Target Balance:"
                  : newOrder.productionType === ProductionType.ResourceToLabor
                    ? "Target Labor Amount:"
                    : "Target Amount:"}
                {!isInfinite && parseInt(maxAmountInput, 10) < 1000 && (
                  <span className="text-red ml-1">(min 1000)</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={isInfinite ? 0 : parseInt(maxAmountInput, 10) || 0}
                  disabled={isInfinite}
                  onChange={(val) => handleMaxAmountChange(String(val))}
                  min={0}
                />
                {newOrder.mode === OrderMode.ProduceOnce && (
                  <>
                    <input
                      type="checkbox"
                      id="isInfinite"
                      checked={isInfinite}
                      onChange={toggleInfinite}
                      className="w-4 h-4"
                    />
                    <label htmlFor="isInfinite" className="text-sm">
                      Infinite
                    </label>
                  </>
                )}
              </div>
              <p className="text-xs text-gold/50 mt-1">
                {newOrder.mode === OrderMode.MaintainBalance
                  ? newOrder.productionType === ProductionType.ResourceToLabor
                    ? "Set the target labor balance to maintain. Production will trigger when labor drops below this minus buffer."
                    : "Set the target balance to maintain. Production will trigger when balance drops below this minus buffer."
                  : 'Set the target amount to produce. Check "Infinite" to keep producing without a limit.'}
              </p>
            </div>

            {newOrder.mode === OrderMode.MaintainBalance && (
              <div>
                <label htmlFor="bufferPercentage" className="block mb-1 text-sm font-medium">
                  Buffer Percentage:
                </label>
                <NumberInput
                  value={newOrder.bufferPercentage || 10}
                  onChange={(val) => setNewOrder((prev) => ({ ...prev, bufferPercentage: val }))}
                  min={0}
                  max={50}
                  className="w-full"
                />
                <p className="text-xs text-gold/50 mt-1">
                  Production will start when balance drops below {100 - (newOrder.bufferPercentage || 10)}% of target.
                  (Current trigger:{" "}
                  {(
                    ((newOrder.maxAmount as number) * (100 - (newOrder.bufferPercentage || 10))) /
                    100
                  ).toLocaleString()}
                  )
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              variant="gold"
              disabled={
                newOrder.resourceToUse === undefined ||
                (newOrder.mode === OrderMode.ProduceOnce &&
                  newOrder.maxAmount !== "infinite" &&
                  newOrder.maxAmount < 1000)
              }
            >
              Add Automation
            </Button>
            <Button onClick={() => setShowAddForm(false)} variant="default" size="md">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {ordersForRealm.length === 0 ? (
        <p>No automation orders set up for this realm yet.</p>
      ) : (
        <div className={`relative ${isRealmPaused ? "opacity-50" : ""}`}>
          {isRealmPaused && (
            <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded">
              <div className="bg-red/90 text-white px-4 py-2 rounded font-bold">AUTOMATION PAUSED</div>
            </div>
          )}
          <table className="w-full text-sm text-left table-auto">
            <thead className="text-xs uppercase bg-gray-700/50 text-gold">
              <tr>
                <th scope="col" className="px-6 py-3">
                  Priority
                </th>
                <th scope="col" className="px-6 py-3">
                  Mode
                </th>
                <th scope="col" className="px-6 py-3">
                  Resource
                </th>
                <th scope="col" className="px-6 py-3">
                  Target/Balance
                </th>
                <th scope="col" className="px-6 py-3">
                  Produced
                </th>
                <th scope="col" className="px-6 py-3">
                  Type
                </th>
                <th scope="col" className="px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {ordersForRealm.map((order) => (
                <tr key={order.id} className="border-b border-gold/50">
                  <td className="px-6 py-4">{order.priority}</td>
                  <td className="px-6 py-4 capitalize">
                    {order.productionType === ProductionType.Transfer ? (
                      <span className="text-purple">
                        {order.transferMode === TransferMode.Recurring && "Recurring"}
                        {order.transferMode === TransferMode.MaintainStock && "Stock"}
                        {order.transferMode === TransferMode.DepletionTransfer && "Depletion"}
                      </span>
                    ) : order.mode === OrderMode.MaintainBalance ? (
                      <span className="text-green">Maintain</span>
                    ) : (
                      <span className="text-blue">Once</span>
                    )}
                  </td>
                  <td className="px-6 py-4 flex items-center">
                    {order.productionType === ProductionType.Transfer ? (
                      <>
                        <span className="text-sm">{order.realmName}</span>
                        <LucideArrowRight className="w-4 h-4 mx-2" />
                        <span className="text-sm">{order.targetEntityName || order.targetEntityId}</span>
                      </>
                    ) : order.productionType === ProductionType.ResourceToLabor ? (
                      <>
                        <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" />
                        <span className="mx-1">→</span>
                        <ResourceIcon resource={"Labor"} size="sm" /> Labor
                      </>
                    ) : order.productionType === ProductionType.LaborToResource ? (
                      <>
                        <ResourceIcon resource={"Labor"} size="sm" />
                        <span className="mx-1">→</span>
                        <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" />
                      </>
                    ) : order.productionType === ProductionType.ResourceToResource ? (
                      <>
                        {eternumConfig.resources.productionByComplexRecipe[order.resourceToUse].map((recipe) => (
                          <ResourceIcon key={recipe.resource} resource={ResourcesIds[recipe.resource]} size="sm" />
                        ))}
                        <span className="mx-1">→</span>
                        <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" />
                      </>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {order.productionType === ProductionType.Transfer ? (
                        <>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {order.transferResources?.map((resource, idx) => (
                              <div key={idx} className="flex items-center bg-gold/10 px-1 py-0.5 rounded text-xs">
                                <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="xs" className="mr-1" />
                                <span>{resource.amount}</span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-gold/50">
                            {order.transferMode === TransferMode.Recurring &&
                              `Every ${formatMinutes(order.transferInterval || 60)}`}
                            {order.transferMode === TransferMode.MaintainStock &&
                              `When < ${order.transferThreshold?.toLocaleString()}`}
                            {order.transferMode === TransferMode.DepletionTransfer &&
                              `When > ${order.transferThreshold?.toLocaleString()}`}
                          </div>
                        </>
                      ) : (
                        <>
                          {order.maxAmount === "infinite" ? "Infinite" : order.maxAmount.toLocaleString()}
                          {order.mode === OrderMode.MaintainBalance && (
                            <>
                              {order.productionType === ProductionType.ResourceToLabor && (
                                <div className="text-xs text-gold/50">Labor Balance</div>
                              )}
                              {order.bufferPercentage && (
                                <div className="text-xs text-gold/50">Buffer: {order.bufferPercentage}%</div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {order.productionType === ProductionType.Transfer || order.mode === OrderMode.MaintainBalance
                      ? "N/A"
                      : order.producedAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 capitalize">
                    {order.productionType === ProductionType.Transfer
                      ? "Transfer"
                      : order.productionType === ProductionType.ResourceToLabor
                        ? "Resource To Labor"
                        : order.productionType === ProductionType.ResourceToResource
                          ? "Resource To Resource"
                          : order.productionType === ProductionType.LaborToResource
                            ? "Labor To Resource"
                            : order.productionType}
                  </td>
                  <td className="px-6 py-4">
                    <Button onClick={() => handleRemoveOrder(order.id)} variant="danger" size="xs">
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
