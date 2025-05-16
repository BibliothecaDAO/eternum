import { AutomationOrder, useAutomationStore } from "@/hooks/store/use-automation-store";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import React, { useMemo, useState } from "react";

interface AutomationTableProps {
  realmEntityId: string;
  realmInfo: RealmInfo;
  availableResources: ResourcesIds[];
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

  const [showAddForm, setShowAddForm] = useState(false);
  const [newOrder, setNewOrder] = useState<Omit<AutomationOrder, "id" | "producedAmount" | "realmEntityId">>(() => ({
    priority: 5,
    // Default to first available resource in the realm, or Wood as a fallback if list is empty or Wood is not in list initially
    resourceToProduce: availableResourcesForRealm[0]?.id || ResourcesIds.Wood,
    maxAmount: 1000,
    productionType: "labor",
    realmName: realmInfo.name,
  }));
  const [maxAmountInput, setMaxAmountInput] = useState<string>("5000");
  const [isInfinite, setIsInfinite] = useState(false);

  // Effect to update default resource if realmInfo (and thus availableResourcesForRealm) changes
  React.useEffect(() => {
    setNewOrder((prev) => ({
      ...prev,
      resourceToProduce: availableResourcesForRealm[0]?.id || ResourcesIds.Wood,
    }));
    // Reset other parts of form if needed when realm context changes, or handle more gracefully
  }, [availableResourcesForRealm]);

  if (!realmEntityId || !realmInfo) {
    return <p>Realm data not available.</p>;
  }

  const handleRemoveOrder = (orderId: string) => {
    removeOrder(realmEntityId, orderId);
  };

  const handleResourceChange = (value: string) => {
    setNewOrder((prev) => ({ ...prev, resourceToProduce: parseInt(value, 10) as ResourcesIds }));
  };

  const handleProductionTypeChange = (value: "resource" | "labor") => {
    setNewOrder((prev) => ({ ...prev, productionType: value }));
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
    if (
      newOrder.resourceToProduce === undefined ||
      !availableResourcesForRealm.find((r) => r.id === newOrder.resourceToProduce)
    ) {
      alert("Please select a valid resource to produce for this realm.");
      return;
    }
    if (newOrder.maxAmount !== "infinite" && newOrder.maxAmount <= 0 && !isInfinite) {
      alert("Target amount must be greater than 0, or set to infinite.");
      return;
    }
    addOrder({ ...newOrder, realmEntityId });
    setShowAddForm(false);
    setNewOrder({
      priority: 5,
      resourceToProduce: availableResourcesForRealm[0]?.id || ResourcesIds.Wood,
      maxAmount: 1000,
      productionType: "resource",
      realmName: realmInfo.name,
    });
    setMaxAmountInput("1000");
    setIsInfinite(false);
  };

  return (
    <div className="p-4 border rounded-lg shadow-md panel-wood">
      <h6 className="text-red/90">IMPORTANT: Your browser must stay open for automation.</h6>
      <h4 className="mb-4 font-bold">
        Automation Orders for Realm {realmInfo.name} ({realmEntityId})
      </h4>
      <p>
        This allows you to select the quantity you want to produce. The automation will attempt to fulfill the orders in
        priority until the target amount is reached.
      </p>

      <div className="my-4">
        <Button onClick={() => setShowAddForm(!showAddForm)} variant="default" size="md">
          {showAddForm ? "Cancel" : "+ Add New Automation Order"}
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddOrder} className="p-4 mb-6 space-y-4 border  border-gold/50 rounded-md bg-black/10">
          <h3 className="text-lg font-semibold">Create New Order</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="productionType" className="block mb-1 text-sm font-medium">
                Production Type:
              </label>
              <Select value={newOrder.productionType} onValueChange={handleProductionTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resource">Standard (Resource-based)</SelectItem>
                  <SelectItem value="labor">Simple (Labor-based)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="priority" className="block mb-1 text-sm font-medium">
                Priority (1-9): (lower is higher priority)
              </label>
              <NumberInput
                value={newOrder.priority}
                onChange={(val) => setNewOrder((prev) => ({ ...prev, priority: val }))}
                min={1}
                max={9}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="resourceToProduce" className="block mb-1 text-sm font-medium">
                Resource to Produce:
              </label>
              <Select
                value={String(newOrder.resourceToProduce)}
                onValueChange={handleResourceChange}
                disabled={availableResourcesForRealm.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {availableResourcesForRealm.length > 0 ? (
                    availableResourcesForRealm.map((res) => (
                      <SelectItem key={res.id} value={String(res.id)}>
                        <div className="flex items-center">
                          <ResourceIcon resource={ResourcesIds[res.id]} size="xs" className="mr-2" />
                          {res.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      No resources available for this realm to automate.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="maxAmount" className="block mb-1 text-sm font-medium">
                Target Amount:
              </label>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={isInfinite ? 0 : parseInt(maxAmountInput, 10) || 0}
                  disabled={isInfinite}
                  onChange={(val) => handleMaxAmountChange(String(val))}
                  min={0}
                  className="w-full"
                />
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
              </div>
            </div>
          </div>

          <Button type="submit" variant="gold" disabled={availableResourcesForRealm.length === 0}>
            Add Automation Order
          </Button>
        </form>
      )}

      {ordersForRealm.length === 0 ? (
        <p>No automation orders set up for this realm yet.</p>
      ) : (
        <table className="w-full text-sm text-left table-auto">
          <thead className="text-xs uppercase bg-gray-700/50 text-gold">
            <tr>
              <th scope="col" className="px-6 py-3">
                Priority
              </th>
              <th scope="col" className="px-6 py-3">
                Resource
              </th>
              <th scope="col" className="px-6 py-3">
                Target
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
              <tr key={order.id} className="border-b border-gray-700 hover:bg-gray-600/30">
                <td className="px-6 py-4">{order.priority}</td>
                <td className="px-6 py-4 flex items-center">
                  <ResourceIcon resource={ResourcesIds[order.resourceToProduce]} size="sm" className="mr-2" />
                  {ResourcesIds[order.resourceToProduce]}
                </td>
                <td className="px-6 py-4">
                  {order.maxAmount === "infinite" ? "Infinite" : order.maxAmount.toLocaleString()}
                </td>
                <td className="px-6 py-4">{order.producedAmount.toLocaleString()}</td>
                <td className="px-6 py-4 capitalize">{order.productionType}</td>
                <td className="px-6 py-4">
                  <Button onClick={() => handleRemoveOrder(order.id)} variant="danger" size="xs">
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
