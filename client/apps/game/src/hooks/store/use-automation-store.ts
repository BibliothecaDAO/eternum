import { ResourcesIds } from "@bibliothecadao/types";
import { calculatePresetAllocations, RealmPresetId } from "@/utils/automation-presets";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const BLOCKED_OUTPUT_RESOURCES: ResourcesIds[] = [ResourcesIds.Wheat, ResourcesIds.Labor];
const BLOCKED_OUTPUT_RESOURCE_SET = new Set<ResourcesIds>(BLOCKED_OUTPUT_RESOURCES);

export const isAutomationResourceBlocked = (
  resourceId: ResourcesIds,
  entityType: RealmEntityType = "realm",
  role: "output" | "input" = "output",
): boolean => {
  if (role === "input") {
    return false;
  }
  return BLOCKED_OUTPUT_RESOURCE_SET.has(resourceId);
};

export const MAX_RESOURCE_ALLOCATION_PERCENT = 90;
export const DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES: ResourceAutomationPercentages = {
  resourceToResource: 0,
  laborToResource: 10,
};

export type RealmEntityType = "realm" | "village";

export interface ResourceAutomationPercentages {
  resourceToResource: number;
  laborToResource: number;
}

export interface ResourceAutomationSettings {
  resourceId: ResourcesIds;
  label?: string;
  percentages: ResourceAutomationPercentages;
  autoManaged: boolean;
  updatedAt: number;
}

export interface ResourceConsumptionRecord {
  resourceId: ResourcesIds;
  amount: number;
}

export interface RealmProductionEntry {
  resourceId: ResourcesIds;
  cycles: number;
  produced: number;
  inputs: ResourceConsumptionRecord[];
  method: "resource-to-resource" | "labor-to-resource";
}

export interface RealmAutomationExecutionSummary {
  executedAt: number;
  resourceToResource: RealmProductionEntry[];
  laborToResource: RealmProductionEntry[];
  consumptionByResource: Record<number, number>;
  outputsByResource: Record<number, number>;
  skipped: { resourceId: ResourcesIds; reason: string }[];
}

export interface RealmAutomationConfig {
  realmId: string;
  realmName?: string;
  entityType: RealmEntityType;
  presetId?: RealmPresetId | null;
  autoBalance: boolean;
  resources: Record<number, ResourceAutomationSettings>;
  createdAt: number;
  updatedAt: number;
  lastExecution?: RealmAutomationExecutionSummary;
}

type RealmAutomationInput = Partial<Omit<RealmAutomationConfig, "realmId" | "resources" | "createdAt" | "updatedAt">>;

interface ProductionAutomationState {
  realms: Record<string, RealmAutomationConfig>;
  nextRunTimestamp: number | null;
  upsertRealm: (realmId: string, data?: RealmAutomationInput) => void;
  setRealmPreset: (realmId: string, presetId: RealmPresetId | null) => void;
  setRealmMetadata: (
    realmId: string,
    metadata: Pick<RealmAutomationConfig, "realmName" | "entityType" | "autoBalance">,
  ) => void;
  ensureResourceConfig: (
    realmId: string,
    resourceId: ResourcesIds,
    options?: { autoManaged?: boolean; label?: string; defaults?: Partial<ResourceAutomationPercentages> },
  ) => ResourceAutomationSettings;
  setResourcePercentages: (
    realmId: string,
    resourceId: ResourcesIds,
    percentages: Partial<ResourceAutomationPercentages>,
  ) => void;
  markResourceAutoManaged: (realmId: string, resourceId: ResourcesIds, autoManaged: boolean) => void;
  removeResourceConfig: (realmId: string, resourceId: ResourcesIds) => void;
  removeRealm: (realmId: string) => void;
  resetRealm: (realmId: string) => void;
  resetAll: () => void;
  setNextRunTimestamp: (timestamp: number | null) => void;
  recordExecution: (realmId: string, summary: RealmAutomationExecutionSummary) => void;
  getRealmConfig: (realmId: string) => RealmAutomationConfig | undefined;
}

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > MAX_RESOURCE_ALLOCATION_PERCENT) return MAX_RESOURCE_ALLOCATION_PERCENT;
  return Math.round(value);
};

const createDefaultResourceSettings = (
  resourceId: ResourcesIds,
  overrides?: Partial<ResourceAutomationSettings>,
  defaults?: Partial<ResourceAutomationPercentages>,
): ResourceAutomationSettings => {
  const now = Date.now();
  const basePercentages = { ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES, ...defaults };
  return {
    resourceId,
    autoManaged: overrides?.autoManaged ?? true,
    label: overrides?.label,
    updatedAt: now,
    percentages: {
      resourceToResource: clampPercent(
        basePercentages.resourceToResource ?? DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.resourceToResource,
      ),
      laborToResource: clampPercent(basePercentages.laborToResource ?? DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.laborToResource),
    },
  };
};

const normalizePercentages = (
  percentages?: Partial<ResourceAutomationPercentages> & { resourceToLabor?: number },
): ResourceAutomationPercentages => ({
  resourceToResource: clampPercent(
    percentages?.resourceToResource ?? DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.resourceToResource,
  ),
  laborToResource: clampPercent(
    percentages?.laborToResource ?? DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.laborToResource,
  ),
});

const sanitizeRealmResources = (
  resources: Record<number, ResourceAutomationSettings> | undefined,
  entityType: RealmEntityType = "realm",
): Record<number, ResourceAutomationSettings> => {
  if (!resources) return {};

  const sanitized: Record<number, ResourceAutomationSettings> = {};

  Object.entries(resources).forEach(([key, value]) => {
    if (!value) return;
    const resourceId = Number(key) as ResourcesIds;
    if (isAutomationResourceBlocked(resourceId, entityType)) return;

    sanitized[resourceId] = {
      ...value,
      resourceId,
      percentages: normalizePercentages(value.percentages as Partial<ResourceAutomationPercentages> & { resourceToLabor?: number }),
    };
  });

  return sanitized;
};

export const useAutomationStore = create<ProductionAutomationState>()(
  persist(
    (set, get) => ({
      realms: {},
      nextRunTimestamp: null,
      upsertRealm: (realmId, data) =>
        set((state) => {
          const existing = state.realms[realmId];
          const now = Date.now();
          if (existing) {
            const metadataChanged =
              (data?.realmName !== undefined && data.realmName !== existing.realmName) ||
              (data?.entityType !== undefined && data.entityType !== existing.entityType) ||
              (data?.autoBalance !== undefined && data.autoBalance !== existing.autoBalance) ||
              (data?.presetId !== undefined && data.presetId !== existing.presetId);

            const sanitizedExisting: RealmAutomationConfig = {
              ...existing,
              resources: sanitizeRealmResources(existing.resources, existing.entityType),
            };

            return {
              realms: {
                ...state.realms,
                [realmId]: metadataChanged
                  ? {
                      ...sanitizedExisting,
                      ...data,
                      updatedAt: now,
                    }
                  : sanitizedExisting,
              },
            };
          }

          const config: RealmAutomationConfig = {
            realmId,
            realmName: data?.realmName,
            entityType: data?.entityType ?? "realm",
            autoBalance: data?.autoBalance ?? true,
            presetId: data?.presetId ?? null,
            resources: {},
            createdAt: now,
            updatedAt: now,
          };

          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...config,
                resources: sanitizeRealmResources(config.resources, config.entityType),
              },
            },
          };
        }),
      setRealmPreset: (realmId, presetId) =>
        set((state) => {
          const target = state.realms[realmId];
          if (!target) return state;

          const normalizedPreset: RealmPresetId =
            presetId === null ? "custom" : (presetId as RealmPresetId);

          if (normalizedPreset === "custom") {
            if (target.presetId === null) return state;
            return {
              realms: {
                ...state.realms,
                [realmId]: {
                  ...target,
                  presetId: null,
                  updatedAt: Date.now(),
                },
              },
            };
          }

          const allocations = calculatePresetAllocations(target, normalizedPreset);
          if (allocations.size === 0) {
            return {
              realms: {
                ...state.realms,
                [realmId]: {
                  ...target,
                  presetId: normalizedPreset,
                  updatedAt: Date.now(),
                },
              },
            };
          }

          const nextResources: Record<number, ResourceAutomationSettings> = {
            ...target.resources,
          };

          allocations.forEach((values, resourceId) => {
            const existing = nextResources[resourceId] ?? createDefaultResourceSettings(resourceId as ResourcesIds);
            nextResources[resourceId] = {
              ...existing,
              percentages: values,
              updatedAt: Date.now(),
            };
          });

          Object.keys(nextResources).forEach((key) => {
            const resourceId = Number(key) as ResourcesIds;
            if (isAutomationResourceBlocked(resourceId, target.entityType)) return;
            if (!allocations.has(Number(key))) {
              const existing = nextResources[Number(key)]!;
              nextResources[Number(key)] = {
                ...existing,
                percentages: {
                  resourceToResource: 0,
                  laborToResource: 0,
                },
                updatedAt: Date.now(),
              };
            }
          });

          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...target,
                presetId: normalizedPreset,
                resources: sanitizeRealmResources(nextResources, target.entityType),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      setRealmMetadata: (realmId, metadata) =>
        set((state) => {
          const target = state.realms[realmId];
          if (!target) return state;
          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...target,
                ...metadata,
                resources: sanitizeRealmResources(target.resources, metadata.entityType ?? target.entityType),
                updatedAt: Date.now(),
              },
            },
          };
        }),
     ensureResourceConfig: (realmId, resourceId, options) => {
        const store = get();
        const realmContext = store.realms[realmId];
        const realmEntityType = realmContext?.entityType ?? "realm";

        if (isAutomationResourceBlocked(resourceId, realmEntityType)) {
          console.debug(
            "[Automation] Skipping resource configuration (blocked)",
            {
              realmId,
              entityType: realmEntityType,
              resourceId,
              resourceName: ResourcesIds[resourceId],
            },
          );
          return createDefaultResourceSettings(
            resourceId,
            { autoManaged: false },
            { resourceToResource: 0, laborToResource: 0 },
          );
        }

        const targetRealm = realmContext;
        if (!targetRealm) {
          store.upsertRealm(realmId, { entityType: "realm" });
        }
        const realm = get().realms[realmId];
        const existing = realm?.resources[resourceId];
        if (existing) {
          return existing;
        }

        const newConfig = createDefaultResourceSettings(
          resourceId,
          { autoManaged: options?.autoManaged ?? true, label: options?.label },
          options?.defaults,
        );

        set((state) => {
          const realmConfig = state.realms[realmId];
          if (!realmConfig) return state;

          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realmConfig,
                resources: sanitizeRealmResources(
                  {
                  ...realmConfig.resources,
                  [resourceId]: newConfig,
                  },
                  realmConfig.entityType,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });

        const realmAfter = get().realms[realmId];
        if (realmAfter?.presetId) {
          get().setRealmPreset(realmId, realmAfter.presetId);
        }

        return newConfig;
      },
      setResourcePercentages: (realmId, resourceId, percentages) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm) return state;
          if (isAutomationResourceBlocked(resourceId, realm.entityType)) {
            return state;
          }

          const current = realm.resources[resourceId] ?? createDefaultResourceSettings(resourceId);
          const updatedPercentages = normalizePercentages({ ...current.percentages, ...percentages });

          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realm,
                resources: sanitizeRealmResources(
                  {
                    ...realm.resources,
                    [resourceId]: {
                      ...current,
                      percentages: updatedPercentages,
                      updatedAt: Date.now(),
                    },
                  },
                  realm.entityType,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      markResourceAutoManaged: (realmId, resourceId, autoManaged) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm) return state;
          if (isAutomationResourceBlocked(resourceId, realm.entityType)) {
            return state;
          }
          const target = realm.resources[resourceId];
          if (!target) return state;
          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realm,
                resources: sanitizeRealmResources(
                  {
                    ...realm.resources,
                    [resourceId]: {
                      ...target,
                      autoManaged,
                      updatedAt: Date.now(),
                    },
                  },
                  realm.entityType,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      removeResourceConfig: (realmId, resourceId) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm || !realm.resources[resourceId]) return state;

          const { [resourceId]: _, ...remaining } = realm.resources;

          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realm,
                resources: sanitizeRealmResources(remaining, realm.entityType),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      removeRealm: (realmId) =>
        set((state) => {
          if (!state.realms[realmId]) return state;
          const { [realmId]: _, ...remaining } = state.realms;
          return { realms: remaining };
        }),
      resetRealm: (realmId) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm) return state;
          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realm,
                resources: {},
                presetId: null,
                updatedAt: Date.now(),
                lastExecution: undefined,
              },
            },
          };
        }),
      resetAll: () => set({ realms: {}, nextRunTimestamp: null }),
      setNextRunTimestamp: (timestamp) => set({ nextRunTimestamp: timestamp }),
      recordExecution: (realmId, summary) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm) return state;
          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realm,
                lastExecution: summary,
                resources: sanitizeRealmResources(realm.resources, realm.entityType),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      getRealmConfig: (realmId) => {
        const realm = get().realms[realmId];
        if (!realm) return undefined;
        return {
          ...realm,
          resources: sanitizeRealmResources(realm.resources, realm.entityType),
        };
      },
    }),
    {
      name: "eternum-production-automation",
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persistedState: any) => {
        const fallback = { realms: {}, nextRunTimestamp: null };
        if (!persistedState || typeof persistedState !== "object") {
          return fallback;
        }

        const incomingRealms = (persistedState as Partial<ProductionAutomationState>)?.realms ?? {};
        const nextRealms: Record<string, RealmAutomationConfig> = {};

        Object.entries(incomingRealms).forEach(([realmId, realmValue]) => {
          if (!realmValue || typeof realmValue !== "object") return;

          const realm = realmValue as RealmAutomationConfig & {
            resources?: Record<number, ResourceAutomationSettings>;
            lastExecution?: any;
          };

          const sanitizedResources = sanitizeRealmResources(realm.resources, realm.entityType ?? "realm");

          let sanitizedLastExecution: RealmAutomationExecutionSummary | undefined;
          if (realm.lastExecution && typeof realm.lastExecution === "object") {
            const { resourceToLabor: _deprecated, ...rest } = realm.lastExecution as any;
            sanitizedLastExecution = {
              executedAt: typeof rest.executedAt === "number" ? rest.executedAt : Date.now(),
              resourceToResource: Array.isArray(rest.resourceToResource) ? rest.resourceToResource : [],
              laborToResource: Array.isArray(rest.laborToResource) ? rest.laborToResource : [],
              consumptionByResource: rest.consumptionByResource ?? {},
              outputsByResource: rest.outputsByResource ?? {},
              skipped: Array.isArray(rest.skipped) ? rest.skipped : [],
            };
          }

          const normalizedPreset: RealmPresetId | null =
            typeof realm.presetId === "string" && realm.presetId !== "custom"
              ? (realm.presetId as RealmPresetId)
              : null;

          nextRealms[realmId] = {
            ...realm,
            presetId: normalizedPreset,
            resources: sanitizedResources,
            lastExecution: sanitizedLastExecution,
          };
        });

        const nextRunTimestamp =
          typeof (persistedState as any).nextRunTimestamp === "number"
            ? (persistedState as any).nextRunTimestamp
            : null;

        return {
          realms: nextRealms,
          nextRunTimestamp,
        };
      },
    },
  ),
);
