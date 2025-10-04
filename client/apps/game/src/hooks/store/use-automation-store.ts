import { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const AUTOMATION_ORDER_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours

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
  createdAt: number; // Timestamp (ms) when the order was created

  // Transfer-specific fields
  targetEntityId?: string; // Destination entity for transfers
  targetEntityName?: string; // Name of the destination entity
  transferMode?: TransferMode; // How the transfer should behave
  transferInterval?: number; // Hours between transfers (for Recurring mode)
  lastTransferTimestamp?: number; // Timestamp of last transfer
  transferThreshold?: number; // Amount threshold for MaintainStock/DepletionTransfer modes
  transferResources?: { resourceId: ResourcesIds; amount: number }[]; // Resources and amounts to transfer
}

// Export/Import type definitions
export interface AutomationExportData {
  version: string; // Version for future compatibility
  exportedAt: number; // Timestamp when exported
  ordersByRealm: Record<string, AutomationOrder[]>;
  pausedRealms: Record<string, boolean>;
  isGloballyPaused: boolean;
  nextRunTimestamp: number | null;
}

// Template types for sharing automation strategies without entity-specific data
export interface AutomationTemplate {
  version: string;
  exportedAt: number;
  isTemplate: true; // Flag to identify this as a template
  templateName?: string; // Optional name for the template
  description?: string; // Optional description of the strategy
  sourceRealmId?: string; // ID of the realm this template was exported from (undefined = all realms)
  sourceRealmName?: string; // Name of the source realm for better identification
  orders: AutomationOrderTemplate[];
}

export interface AutomationOrderTemplate {
  priority: number;
  resourceToUse: ResourcesIds;
  mode: OrderMode;
  maxAmount: number | "infinite";
  productionType: ProductionType;
  bufferPercentage?: number;

  // Transfer-specific fields (without entity IDs)
  transferMode?: TransferMode;
  transferInterval?: number;
  transferThreshold?: number;
  transferResources?: { resourceId: ResourcesIds; amount: number }[];
}

interface AutomationState {
  ordersByRealm: Record<string, AutomationOrder[]>;
  pausedRealms: Record<string, boolean>; // Track paused state by realm ID
  isGloballyPaused: boolean; // Global pause state - overrides all other automation
  addOrder: (orderData: Omit<AutomationOrder, "id" | "producedAmount" | "createdAt"> & { mode?: OrderMode }) => void;
  updateOrder: (
    realmEntityId: string,
    orderId: string,
    updatedData: Omit<AutomationOrder, "id" | "producedAmount" | "realmEntityId" | "createdAt">,
  ) => void;
  removeOrder: (realmEntityId: string, orderId: string) => void;
  updateOrderProducedAmount: (realmEntityId: string, orderId: string, producedThisCycle: number) => void;
  updateTransferTimestamp: (realmEntityId: string, orderId: string) => void; // Update last transfer timestamp
  getOrdersForRealm: (realmEntityId: string) => AutomationOrder[];
  removeAllOrders: (realmEntityId?: string) => void; // realmEntityId is optional
  nextRunTimestamp: number | null; // Timestamp for the next automation run
  setNextRunTimestamp: (timestamp: number) => void; // Action to set the next run timestamp
  toggleRealmPause: (realmEntityId: string) => void; // Toggle pause state for a realm
  isRealmPaused: (realmEntityId: string) => boolean; // Check if a realm is paused
  toggleGlobalPause: () => void; // Toggle global pause state
  cleanupStaleOrders: (maxAgeMs?: number) => number; // Remove and count expired orders
  exportAutomation: () => AutomationExportData; // Export current automation state
  importAutomation: (data: AutomationExportData) => { success: boolean; error?: string }; // Import automation state
  exportAsTemplate: (name?: string, description?: string, realmEntityId?: string) => AutomationTemplate; // Export as shareable template
  importTemplate: (template: AutomationTemplate) => AutomationOrderTemplate[]; // Import template and return orders for manual assignment
  getAvailableRealms: () => { id: string; name?: string; orderCount: number }[]; // Get list of realms with automation orders
}

interface PrunedOrdersResult {
  ordersByRealm: Record<string, AutomationOrder[]>;
  removedCount: number;
  changed: boolean;
}

const normalizeAndPruneOrders = (
  ordersByRealm: Record<string, AutomationOrder[]>,
  now: number,
  maxAgeMs: number,
): PrunedOrdersResult => {
  let removedCount = 0;
  let changed = false;

  const nextOrders: Record<string, AutomationOrder[]> = {};

  for (const [realmId, orders] of Object.entries(ordersByRealm)) {
    if (!Array.isArray(orders) || orders.length === 0) {
      continue;
    }

    const refreshedOrders: AutomationOrder[] = [];

    for (const order of orders) {
      let orderWithTimestamp = order;

      if (typeof order.createdAt !== "number") {
        orderWithTimestamp = { ...order, createdAt: now };
        changed = true;
      }

      const age = now - orderWithTimestamp.createdAt;
      if (Number.isFinite(age) && age > maxAgeMs) {
        removedCount += 1;
        changed = true;
        continue;
      }

      if (orderWithTimestamp !== order) {
        refreshedOrders.push(orderWithTimestamp);
      } else {
        refreshedOrders.push(order);
      }
    }

    if (refreshedOrders.length > 0) {
      nextOrders[realmId] = refreshedOrders;
    } else {
      changed = true;
    }
  }

  return {
    ordersByRealm: nextOrders,
    removedCount,
    changed,
  };
};

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      ordersByRealm: {},
      pausedRealms: {},
      isGloballyPaused: false, // Initialize global pause state
      nextRunTimestamp: null, // Initialize nextRunTimestamp
      addOrder: (newOrderData) => {
        const newOrder: AutomationOrder = {
          ...newOrderData,
          mode: newOrderData.mode || OrderMode.ProduceOnce, // Default to ProduceOnce for backward compatibility
          realmEntityId: String(newOrderData.realmEntityId),
          id: crypto.randomUUID(),
          producedAmount: 0,
          createdAt: Date.now(),
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
      updateOrder: (realmEntityId, orderId, updatedData) =>
        set((state) => {
          const realmOrders = state.ordersByRealm[realmEntityId] || [];
          if (realmOrders.length === 0) {
            return state;
          }

          return {
            ordersByRealm: {
              ...state.ordersByRealm,
              [realmEntityId]: realmOrders.map((order) =>
                order.id === orderId
                  ? {
                      ...order,
                      ...updatedData,
                      realmEntityId,
                    }
                  : order,
              ),
            },
          };
        }),
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
      cleanupStaleOrders: (maxAgeMs = AUTOMATION_ORDER_MAX_AGE_MS) => {
        const now = Date.now();
        let removed = 0;
        set((state) => {
          const { ordersByRealm, removedCount, changed } = normalizeAndPruneOrders(state.ordersByRealm, now, maxAgeMs);

          removed = removedCount;

          if (!changed) {
            return state;
          }

          return {
            ordersByRealm,
          };
        });

        return removed;
      },
      exportAutomation: () => {
        const state = get();
        const exportData: AutomationExportData = {
          version: "1.0.0", // Version for future compatibility
          exportedAt: Date.now(),
          ordersByRealm: state.ordersByRealm,
          pausedRealms: state.pausedRealms,
          isGloballyPaused: state.isGloballyPaused,
          nextRunTimestamp: state.nextRunTimestamp,
        };
        return exportData;
      },
      importAutomation: (data: AutomationExportData) => {
        try {
          // Validate the import data structure
          if (!data || typeof data !== "object") {
            return { success: false, error: "Invalid data format" };
          }

          if (!data.version || !data.exportedAt) {
            return { success: false, error: "Missing version or export timestamp" };
          }

          // Validate ordersByRealm structure
          if (!data.ordersByRealm || typeof data.ordersByRealm !== "object") {
            return { success: false, error: "Invalid ordersByRealm structure" };
          }

          // Validate each order has required fields
          for (const [realmId, orders] of Object.entries(data.ordersByRealm)) {
            if (!Array.isArray(orders)) {
              return { success: false, error: `Orders for realm ${realmId} must be an array` };
            }

            for (const order of orders) {
              if (!order.id || !order.realmEntityId || typeof order.priority !== "number") {
                return { success: false, error: "Order missing required fields" };
              }

              if (!Object.values(ProductionType).includes(order.productionType)) {
                return { success: false, error: `Invalid production type: ${order.productionType}` };
              }

              if (!Object.values(OrderMode).includes(order.mode)) {
                return { success: false, error: `Invalid order mode: ${order.mode}` };
              }

              // Validate transfer-specific fields if it's a transfer order
              if (order.productionType === ProductionType.Transfer) {
                if (!order.targetEntityId || !order.transferMode || !order.transferResources) {
                  return { success: false, error: "Transfer order missing required fields" };
                }

                if (!Object.values(TransferMode).includes(order.transferMode)) {
                  return { success: false, error: `Invalid transfer mode: ${order.transferMode}` };
                }
              }
            }
          }

          // If validation passes, update the store
          const now = Date.now();
          const { ordersByRealm } = normalizeAndPruneOrders(data.ordersByRealm, now, AUTOMATION_ORDER_MAX_AGE_MS);

          set({
            ordersByRealm,
            pausedRealms: data.pausedRealms || {},
            isGloballyPaused: data.isGloballyPaused || false,
            nextRunTimestamp: data.nextRunTimestamp || null,
          });

          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" };
        }
      },
      exportAsTemplate: (name?: string, description?: string, realmEntityId?: string) => {
        const state = get();
        const allOrders: AutomationOrder[] = [];

        if (realmEntityId) {
          // Export orders from specific realm only
          const realmOrders = state.ordersByRealm[realmEntityId] || [];
          allOrders.push(...realmOrders);
        } else {
          // Collect all orders from all realms (legacy behavior)
          Object.values(state.ordersByRealm).forEach((realmOrders) => {
            allOrders.push(...realmOrders);
          });
        }

        // Convert orders to templates (removing entity-specific data)
        const templateOrders: AutomationOrderTemplate[] = allOrders.map((order) => ({
          priority: order.priority,
          resourceToUse: order.resourceToUse,
          mode: order.mode,
          maxAmount: order.maxAmount,
          productionType: order.productionType,
          bufferPercentage: order.bufferPercentage,
          // Transfer-specific fields (without entity IDs)
          transferMode: order.transferMode,
          transferInterval: order.transferInterval,
          transferThreshold: order.transferThreshold,
          transferResources: order.transferResources,
        }));

        // Sort by priority for better readability
        templateOrders.sort((a, b) => a.priority - b.priority);

        const template: AutomationTemplate = {
          version: "1.0.0",
          exportedAt: Date.now(),
          isTemplate: true,
          templateName: name,
          description: description,
          sourceRealmId: realmEntityId,
          sourceRealmName: realmEntityId ? allOrders[0]?.realmName : undefined,
          orders: templateOrders,
        };

        return template;
      },
      importTemplate: (template: AutomationTemplate) => {
        // Validate template structure
        if (!template || !template.isTemplate || !Array.isArray(template.orders)) {
          throw new Error("Invalid template format");
        }

        // Return the template orders for manual assignment
        // The UI will need to handle assigning these to specific realms
        return template.orders;
      },
      getAvailableRealms: () => {
        const state = get();
        return Object.entries(state.ordersByRealm)
          .filter(([_, orders]) => orders && orders.length > 0)
          .map(([realmId, orders]) => ({
            id: realmId,
            name: orders[0]?.realmName, // Get realm name from first order
            orderCount: orders.length,
          }))
          .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      },
    }),
    {
      name: "eternum-automation-orders-by-realm",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state || typeof state !== "object" || !state.ordersByRealm) {
          return;
        }

        const now = Date.now();
        const { ordersByRealm, changed } = normalizeAndPruneOrders(
          state.ordersByRealm,
          now,
          AUTOMATION_ORDER_MAX_AGE_MS,
        );

        if (changed) {
          state.ordersByRealm = ordersByRealm;
        }
      },
    },
  ),
);
