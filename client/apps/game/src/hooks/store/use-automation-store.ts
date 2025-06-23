import { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export enum ProductionType {
  ResourceToResource = "resource_to_resource",
  ResourceToLabor = "resource_to_labor",
  LaborToResource = "labor_to_resource",
  Transfer = "transfer", // New type for entity-to-entity transfers
}

export enum OrderMode {
  ProduceOnce = "produce_once", // Produce up to maxAmount then stop
  MaintainBalance = "maintain_balance", // Keep balance at target level
}

export enum TransferMode {
  Recurring = "recurring", // Transfer at regular intervals
  MaintainStock = "maintain_stock", // Transfer when destination falls below threshold
  DepletionTransfer = "depletion_transfer", // Transfer when source exceeds threshold
}

export interface AutomationOrder {
  id: string; // Unique identifier for the order
  priority: number; // 1-9, 1 is highest for this realm
  resourceToUse: ResourcesIds; // resource to product (labor or resource) or resource to use for labor production
  mode: OrderMode; // Whether to produce once or maintain balance
  maxAmount: number | "infinite"; // For ProduceOnce: target amount to produce. For MaintainBalance: target balance to maintain
  producedAmount: number; // How much has been produced by this order so far (for ProduceOnce mode)
  realmEntityId: string; // Store as string, consistent for object keys (for production: source entity, for transfer: source entity)
  productionType: ProductionType; // Example: to distinguish system calls
  realmName?: string; // Name of the realm
  bufferPercentage?: number; // For MaintainBalance: percentage buffer below target before producing (default 10%)

  // Transfer-specific fields
  targetEntityId?: string; // Destination entity for transfers
  targetEntityName?: string; // Name of the destination entity
  transferMode?: TransferMode; // How the transfer should behave
  transferInterval?: number; // Hours between transfers (for Recurring mode)
  lastTransferTimestamp?: number; // Timestamp of last transfer
  transferThreshold?: number; // Amount threshold for MaintainStock/DepletionTransfer modes
  transferResources?: { resourceId: ResourcesIds; amount: number }[]; // Resources and amounts to transfer
}

interface AutomationState {
  ordersByRealm: Record<string, AutomationOrder[]>;
  pausedRealms: Record<string, boolean>; // Track paused state by realm ID
  isGloballyPaused: boolean; // Global pause state for all automation
  addOrder: (orderData: Omit<AutomationOrder, "id" | "producedAmount"> & { mode?: OrderMode }) => void;
  removeOrder: (realmEntityId: string, orderId: string) => void;
  updateOrderProducedAmount: (realmEntityId: string, orderId: string, producedThisCycle: number) => void;
  updateTransferTimestamp: (realmEntityId: string, orderId: string) => void; // Update last transfer timestamp
  getOrdersForRealm: (realmEntityId: string) => AutomationOrder[];
  removeAllOrders: (realmEntityId?: string) => void; // realmEntityId is optional
  nextRunTimestamp: number | null; // Timestamp for the next automation run
  setNextRunTimestamp: (timestamp: number) => void; // Action to set the next run timestamp
  toggleRealmPause: (realmEntityId: string) => void; // Toggle pause state for a realm
  isRealmPaused: (realmEntityId: string) => boolean; // Check if a realm is paused
  toggleGlobalPause: () => void; // Toggle global pause state for all automation
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      ordersByRealm: {},
      pausedRealms: {},
      isGloballyPaused: false, // Initialize global pause as false
      nextRunTimestamp: null, // Initialize nextRunTimestamp
      addOrder: (newOrderData) => {
        const newOrder: AutomationOrder = {
          ...newOrderData,
          mode: newOrderData.mode || OrderMode.ProduceOnce, // Default to ProduceOnce for backward compatibility
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
      updateTransferTimestamp: (realmEntityId, orderId) =>
        set((state) => ({
          ordersByRealm: {
            ...state.ordersByRealm,
            [realmEntityId]: (state.ordersByRealm[realmEntityId] || []).map((order) =>
              order.id === orderId ? { ...order, lastTransferTimestamp: Date.now() } : order,
            ),
          },
        })),
      setNextRunTimestamp: (timestamp) => set({ nextRunTimestamp: timestamp }), // Implement setNextRunTimestamp
      getOrdersForRealm: (realmEntityId: string) => {
        return get().ordersByRealm[realmEntityId] || [];
      },
      toggleRealmPause: (realmEntityId: string) =>
        set((state) => ({
          pausedRealms: {
            ...state.pausedRealms,
            [realmEntityId]: !state.pausedRealms[realmEntityId],
          },
        })),
      isRealmPaused: (realmEntityId: string) => {
        return get().pausedRealms[realmEntityId] || false;
      },
      toggleGlobalPause: () =>
        set((state) => ({
          isGloballyPaused: !state.isGloballyPaused,
        })),
    }),
    {
      name: "eternum-automation-orders-by-realm",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
