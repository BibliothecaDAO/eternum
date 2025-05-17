import { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export enum ProductionType {
  ResourceToResource = "resource_to_resource",
  ResourceToLabor = "resource_to_labor",
  LaborToResource = "labor_to_resource",
}

export interface AutomationOrder {
  id: string; // Unique identifier for the order
  priority: number; // 1-9, 1 is highest for this realm
  resourceToUse: ResourcesIds; // resource to product (labor or resource) or resource to use for labor production
  maxAmount: number | "infinite"; // Target amount to produce
  producedAmount: number; // How much has been produced by this order so far
  realmEntityId: string; // Store as string, consistent for object keys
  productionType: ProductionType; // Example: to distinguish system calls
  realmName?: string; // Name of the realm
}

interface AutomationState {
  ordersByRealm: Record<string, AutomationOrder[]>;
  addOrder: (orderData: Omit<AutomationOrder, "id" | "producedAmount">) => void;
  removeOrder: (realmEntityId: string, orderId: string) => void;
  updateOrderProducedAmount: (realmEntityId: string, orderId: string, producedThisCycle: number) => void;
  getOrdersForRealm: (realmEntityId: string) => AutomationOrder[];
  removeAllOrders: (realmEntityId?: string) => void; // realmEntityId is optional
  nextRunTimestamp: number | null; // Timestamp for the next automation run
  setNextRunTimestamp: (timestamp: number) => void; // Action to set the next run timestamp
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      ordersByRealm: {},
      nextRunTimestamp: null, // Initialize nextRunTimestamp
      addOrder: (newOrderData) => {
        const newOrder: AutomationOrder = {
          ...newOrderData,
          realmEntityId: String(newOrderData.realmEntityId),
          id: crypto.randomUUID(),
          producedAmount: 0,
        };
        set((state) => {
          const realmOrders = state.ordersByRealm[newOrder.realmEntityId] || [];
          return {
            ordersByRealm: {
              ...state.ordersByRealm,
              [newOrder.realmEntityId]: [...realmOrders, newOrder],
            },
          };
        });
      },
      removeOrder: (realmEntityId, orderId) =>
        set((state) => {
          const realmOrders = state.ordersByRealm[realmEntityId] || [];
          const updatedRealmOrders = realmOrders.filter((order) => order.id !== orderId);
          if (updatedRealmOrders.length === 0 && realmOrders.length > 0) {
            // If all orders for a realm are removed, remove the realm key itself
            const { [realmEntityId]: _, ...remainingRealms } = state.ordersByRealm;
            return { ordersByRealm: remainingRealms };
          }
          return {
            ordersByRealm: {
              ...state.ordersByRealm,
              [realmEntityId]: updatedRealmOrders,
            },
          };
        }),
      removeAllOrders: (realmEntityId?: string) =>
        set((state) => {
          if (realmEntityId && realmEntityId !== "all") {
            // Remove orders for a specific realm
            const { [realmEntityId]: _, ...remainingRealms } = state.ordersByRealm;
            return { ordersByRealm: remainingRealms };
          } else {
            // Remove all orders from all realms
            return { ordersByRealm: {} };
          }
        }),
      updateOrderProducedAmount: (realmEntityId, orderId, producedThisCycle) =>
        set((state) => ({
          ordersByRealm: {
            ...state.ordersByRealm,
            [realmEntityId]: (state.ordersByRealm[realmEntityId] || []).map((order) =>
              order.id === orderId ? { ...order, producedAmount: order.producedAmount + producedThisCycle } : order,
            ),
          },
        })),
      setNextRunTimestamp: (timestamp) => set({ nextRunTimestamp: timestamp }), // Implement setNextRunTimestamp
      getOrdersForRealm: (realmEntityId: string) => {
        return get().ordersByRealm[realmEntityId] || [];
      },
    }),
    {
      name: "eternum-automation-orders-by-realm",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
