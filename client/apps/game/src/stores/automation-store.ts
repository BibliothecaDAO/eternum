import { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AutomationOrder {
  id: string; // Unique identifier for the order
  priority: number; // 1-9, 1 is highest
  resourceToProduce: ResourcesIds; // ID of the resource
  maxAmount: number | "infinite"; // Target amount to produce
  producedAmount: number; // How much has been produced by this order so far
  realmEntityId: string; // Entity ID of the realm this order belongs to
  // We might need to store which specific system call or production type this is for
  // e.g., 'resource_based' or 'labor_based' if it's not deducible from resourceToProduce
  productionType: "resource" | "labor"; // Example: to distinguish system calls
}

interface AutomationState {
  orders: AutomationOrder[];
  addOrder: (order: Omit<AutomationOrder, "id" | "producedAmount">) => void;
  removeOrder: (orderId: string) => void;
  updateOrderProducedAmount: (orderId: string, producedThisCycle: number) => void;
  // TODO: Potentially add updateOrder for priority, maxAmount etc.
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (newOrderData) => {
        const newOrder: AutomationOrder = {
          ...newOrderData,
          id: crypto.randomUUID(), // Generate a unique ID
          producedAmount: 0,
        };
        set((state) => ({ orders: [...state.orders, newOrder] }));
      },
      removeOrder: (orderId) =>
        set((state) => ({
          orders: state.orders.filter((order) => order.id !== orderId),
        })),
      updateOrderProducedAmount: (orderId, producedThisCycle) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, producedAmount: order.producedAmount + producedThisCycle } : order,
          ),
        })),
    }),
    {
      name: "eternum-automation-orders", // Name for local storage
      storage: createJSONStorage(() => localStorage), // Use localStorage
    },
  ),
);

// Example of how to add an order (for testing/integration later):
// useAutomationStore.getState().addOrder({
//   priority: 1,
//   resourceToProduce: 101, // e.g., Wood ID
//   maxAmount: 1000,
//   realmEntityId: "0x123abc",
//   productionType: 'resource'
// });
