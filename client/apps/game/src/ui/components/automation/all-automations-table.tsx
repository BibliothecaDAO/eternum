import { AutomationOrder, ProductionType, useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { ResourcesIds } from "@bibliothecadao/types";
import React, { useEffect, useMemo, useState } from "react";
import { ProductionModal } from "../production/production-modal";

export const AllAutomationsTable: React.FC = () => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  const ordersByRealm = useAutomationStore((state) => state.ordersByRealm);
  const removeOrder = useAutomationStore((state) => state.removeOrder);

  // Realm filter state
  const [realmFilter, setRealmFilter] = useState<string>("all");

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
      <div className="flex justify-center items-center h-full">
        <Button onClick={() => toggleModal(<ProductionModal />)}>Add Automation</Button>
      </div>
    );
  }

  return (
    <div className=" ">
      <h4 className="mb-2 font-bold">Automation</h4>

      <Button onClick={() => toggleModal(<ProductionModal />)}>Add Automation</Button>

      {/* Realm filter */}
      <div className="mb-4 flex items-center text-sm">
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
      </div>

      <table className="w-full text-sm text-left table-auto">
        <thead className="text-xs uppercase bg-gray-700/50 text-gold">
          <tr>
            <th scope="col" className="px-6">
              Order
            </th>
            <th scope="col" className="px-6">
              Progress
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedOrders.map((order) => (
            <tr key={order.id} className="border-b border-gold/10 hover:bg-gray-600/30">
              <td className=" py-4">
                <div className="flex items-center mb-1">
                  {order.productionType === ProductionType.ResourceToLabor ? (
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
                      <ResourceIcon resource={ResourcesIds[order.resourceToUse]} size="sm" className="mr-2" />
                      {ResourcesIds[order.resourceToUse]}
                    </>
                  )}
                </div>
                <div className="text-xs bg-gold/20 px-2 py-1 rounded border border-gold/30">
                  <div className="h4">{order.realmName ?? order.realmEntityId}</div>
                  <div className="font-bold">Priority {order.priority}</div>

                  {order.productionType === ProductionType.ResourceToLabor
                    ? "Resource To Labor"
                    : order.productionType === ProductionType.ResourceToResource
                      ? "Resource To Resource"
                      : order.productionType === ProductionType.LaborToResource
                        ? "Labor To Resource"
                        : order.productionType}
                </div>

                <Button
                  onClick={() => removeOrder(order.realmEntityId, order.id)}
                  variant="danger"
                  size="xs"
                  className="mt-1"
                >
                  Remove
                </Button>
              </td>
              <td className="px-6 py-4 text-lg">
                {order.producedAmount.toLocaleString()} /{" "}
                {order.maxAmount === "infinite" ? "∞" : order.maxAmount.toLocaleString()}{" "}
                {order.maxAmount !== "infinite" && order.maxAmount > 0 && (
                  <span className="text-xs text-gray-400">
                    ({Math.floor((order.producedAmount / order.maxAmount) * 100)}% )
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AllAutomationsTable;
