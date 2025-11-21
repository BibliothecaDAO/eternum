import {
  calculatePresetAllocations,
  calculateResourceBootstrapAllocation,
  RealmPresetId,
} from "@/utils/automation-presets";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const BLOCKED_OUTPUT_RESOURCES: ResourcesIds[] = [ResourcesIds.Wheat, ResourcesIds.Labor];
const BLOCKED_OUTPUT_RESOURCE_SET = new Set<ResourcesIds>(BLOCKED_OUTPUT_RESOURCES);

const resolveCurrentGameId = (): string => {
  try {
    const season = configManager.getSeasonConfig();
    return `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
  } catch (_error) {
    return "unknown";
  }
};

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
  laborToResource: 5,
};
export const DONKEY_DEFAULT_RESOURCE_PERCENT = 10;

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
  presetId: RealmPresetId;
  autoBalance: boolean;
  resources: Record<number, ResourceAutomationSettings>;
  createdAt: number;
  updatedAt: number;
  lastExecution?: RealmAutomationExecutionSummary;
}

export enum ProductionType {
  ResourceToResource = "resource-to-resource",
  LaborToResource = "labor-to-resource",
  ResourceToLabor = "resource-to-labor",
  Transfer = "transfer",
}

type RealmAutomationInput = Partial<Omit<RealmAutomationConfig, "realmId" | "resources" | "createdAt" | "updatedAt">>;

interface ProductionAutomationState {
  realms: Record<string, RealmAutomationConfig>;
  nextRunTimestamp: number | null;
  hydrated: boolean;
  gameId: string;
  upsertRealm: (realmId: string, data?: RealmAutomationInput) => void;
  setRealmPreset: (realmId: string, presetId: RealmPresetId) => void;
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
  setHydrated: (value: boolean) => void;
  setRealmPresetConfig: (
    realmId: string,
    presetId: RealmPresetId,
    percentages: Record<number, ResourceAutomationPercentages>,
  ) => void;
  pruneForGame: (gameId: string) => void;
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
  const basePercentages = {
    ...DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES,
    ...(resourceId === ResourcesIds.Donkey
      ? { resourceToResource: DONKEY_DEFAULT_RESOURCE_PERCENT, laborToResource: 0 }
      : {}),
    ...defaults,
  };
  return {
    resourceId,
    autoManaged: overrides?.autoManaged ?? true,
    label: overrides?.label,
    updatedAt: now,
    percentages: {
      resourceToResource: clampPercent(
        basePercentages.resourceToResource ?? DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.resourceToResource,
      ),
      laborToResource: clampPercent(
        basePercentages.laborToResource ?? DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.laborToResource,
      ),
    },
  };
};

const normalizePercentages = (
  percentages?: Partial<ResourceAutomationPercentages> & { resourceToLabor?: number },
  resourceId?: ResourcesIds,
): ResourceAutomationPercentages => {
  const resourceDefault =
    resourceId === ResourcesIds.Donkey
      ? DONKEY_DEFAULT_RESOURCE_PERCENT
      : DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.resourceToResource;
  const laborDefault = resourceId === ResourcesIds.Donkey ? 0 : DEFAULT_RESOURCE_AUTOMATION_PERCENTAGES.laborToResource;

  const resourceToResource = clampPercent(percentages?.resourceToResource ?? resourceDefault);
  const laborToResource =
    resourceId === ResourcesIds.Donkey ? 0 : clampPercent(percentages?.laborToResource ?? laborDefault);

  return {
    resourceToResource,
    laborToResource,
  };
};

const normalizePresetId = (preset?: RealmPresetId | string | null): RealmPresetId => {
  if (preset === "labor" || preset === "resource" || preset === "idle" || preset === "custom") {
    return preset;
  }
  return "labor";
};

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
      percentages: normalizePercentages(
        value.percentages as Partial<ResourceAutomationPercentages> & { resourceToLabor?: number },
        resourceId,
      ),
    };
  });

  return sanitized;
};

export const useAutomationStore = create<ProductionAutomationState>()(
  persist(
    (set, get) => ({
      realms: {},
      nextRunTimestamp: null,
      hydrated: typeof window === "undefined",
      gameId: resolveCurrentGameId(),
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
              presetId: normalizePresetId(existing.presetId),
            };
            let nextRealm = sanitizedExisting;
            if (metadataChanged) {
              nextRealm = {
                ...sanitizedExisting,
                ...data,
                presetId: normalizePresetId(
                  (data?.presetId as RealmPresetId | string | null | undefined) ?? sanitizedExisting.presetId,
                ),
                updatedAt: now,
              };
            }
            return {
              realms: {
                ...state.realms,
                [realmId]: nextRealm,
              },
            };
          }

          const config: RealmAutomationConfig = {
            realmId,
            realmName: data?.realmName,
            entityType: data?.entityType ?? "realm",
            autoBalance: data?.autoBalance ?? true,
            // Default to labor preset for new realms so bootstrapped
            // resources start from a labor-friendly baseline.
            presetId: normalizePresetId(data?.presetId ?? "labor"),
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

          const normalizedPreset = presetId;
          const allocations = calculatePresetAllocations(target, normalizedPreset);
          if (allocations.size === 0) {
            const nextState = {
              realms: {
                ...state.realms,
                [realmId]: {
                  ...target,
                  presetId: normalizedPreset,
                  updatedAt: Date.now(),
                },
              },
            };
            return nextState;
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

          const nextState = {
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
          return nextState;
        }),
      setRealmPresetConfig: (realmId, presetId, percentages) =>
        set((state) => {
          const target = state.realms[realmId];
          if (!target) return state;

          const now = Date.now();
          const entityType = target.entityType;

          const nextResources: Record<number, ResourceAutomationSettings> = {
            ...target.resources,
          };

          Object.entries(percentages).forEach(([key, value]) => {
            const resourceId = Number(key) as ResourcesIds;
            if (isAutomationResourceBlocked(resourceId, entityType)) {
              return;
            }

            const existing = nextResources[resourceId] ?? createDefaultResourceSettings(resourceId);
            nextResources[resourceId] = {
              ...existing,
              percentages: {
                resourceToResource: value.resourceToResource,
                laborToResource: value.laborToResource,
              },
              updatedAt: now,
            };
          });

          Object.keys(nextResources).forEach((key) => {
            const resourceId = Number(key) as ResourcesIds;
            if (isAutomationResourceBlocked(resourceId, entityType)) {
              return;
            }
            if (!(resourceId in percentages)) {
              const existing = nextResources[resourceId]!;
              nextResources[resourceId] = {
                ...existing,
                percentages: {
                  resourceToResource: 0,
                  laborToResource: 0,
                },
                updatedAt: now,
              };
            }
          });

          return {
            realms: {
              ...state.realms,
              [realmId]: {
                ...target,
                presetId,
                resources: sanitizeRealmResources(nextResources, entityType),
                updatedAt: now,
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

        const shouldReapplyResourcePreset = realm?.presetId === "resource";

        const baseConfig = createDefaultResourceSettings(
          resourceId,
          { autoManaged: options?.autoManaged ?? true, label: options?.label },
          options?.defaults,
        );

        let newConfig = baseConfig;
        if (realm && realm.presetId === "custom") {
          const hasExistingResources = Object.keys(realm.resources ?? {}).length > 0;
          // Only bootstrap from the resource preset when there are already
          // other resources configured; for the very first resource on a realm,
          // prefer the default labor-friendly baseline (0% resource, 5% labor).
          if (hasExistingResources) {
            const configWithResource: RealmAutomationConfig = {
              ...realm,
              resources: {
                ...realm.resources,
                [resourceId]: baseConfig,
              },
            };
            const bootstrapAllocation = calculateResourceBootstrapAllocation(configWithResource, resourceId);
            if (bootstrapAllocation && bootstrapAllocation.resourceToResource > 0) {
              newConfig = {
                ...baseConfig,
                percentages: {
                  resourceToResource: bootstrapAllocation.resourceToResource,
                  laborToResource: bootstrapAllocation.laborToResource,
                },
              };
            }
          }
        }

        set((state) => {
          const realmConfig = state.realms[realmId];
          if (!realmConfig) return state;

          const nextState = {
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
          // quiet
          return nextState;
        });

        if (shouldReapplyResourcePreset) {
          // If the realm is currently using the resource preset,
          // re-apply it so the new building/resource is included
          // in the preset allocation across all resources.
          store.setRealmPreset(realmId, "resource");
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
          const updatedPercentages = normalizePercentages({ ...current.percentages, ...percentages }, resourceId);
          const changed =
            updatedPercentages.resourceToResource !== current.percentages.resourceToResource ||
            updatedPercentages.laborToResource !== current.percentages.laborToResource;

          if (!changed && realm.resources[resourceId]) {
            return state;
          }

          const nextState = {
            realms: {
              ...state.realms,
              [realmId]: {
                ...realm,
                presetId: "custom",
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
          // quiet
          return nextState;
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
                presetId: "labor",
                updatedAt: Date.now(),
                lastExecution: undefined,
              },
            },
          };
        }),
      resetAll: () =>
        set((state) => ({
          realms: {},
          nextRunTimestamp: null,
          hydrated: state.hydrated,
        })),
      setNextRunTimestamp: (timestamp) => set({ nextRunTimestamp: timestamp }),
      recordExecution: (realmId, summary) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm) return state;
          const nextState = {
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
          return nextState;
        }),
      getRealmConfig: (realmId) => {
        const realm = get().realms[realmId];
        if (!realm) return undefined;
        return {
          ...realm,
          resources: sanitizeRealmResources(realm.resources, realm.entityType),
        };
      },
      setHydrated: (value) => set({ hydrated: value }),
      pruneForGame: (gameId) =>
        set((state) => {
          if (state.gameId === gameId) return state;
          return {
            realms: {},
            nextRunTimestamp: null,
            gameId,
          };
        }),
    }),
    {
      name: "eternum-production-automation",
      storage: createJSONStorage(() => localStorage),
      version: 6,
      partialize: (state) => ({
        realms: state.realms,
        nextRunTimestamp: state.nextRunTimestamp,
        gameId: state.gameId,
      }),
      migrate: (persistedState: any) => {
        const currentGameId = resolveCurrentGameId();
        const fallback = { realms: {}, nextRunTimestamp: null, gameId: currentGameId };
        if (!persistedState || typeof persistedState !== "object") {
          return fallback;
        }

        const persistedGameId =
          typeof (persistedState as any).gameId === "string" ? (persistedState as any).gameId : null;
        if (!persistedGameId || persistedGameId !== currentGameId) {
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

          const rawPreset = realm.presetId;
          let normalizedPreset: RealmPresetId = "labor";
          if (rawPreset === "labor" || rawPreset === "resource" || rawPreset === "idle" || rawPreset === "custom") {
            normalizedPreset = rawPreset;
          } else if (rawPreset === null) {
            normalizedPreset = "custom";
          } else if (typeof rawPreset === "string") {
            normalizedPreset = "custom";
          }

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
          gameId: persistedGameId,
        };
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error("[Automation] Failed to rehydrate automation store", error);
          }
          // Hydration completion is handled via persist.onFinishHydration below to avoid TDZ issues.
        };
      },
    },
  ),
);

if (typeof window !== "undefined") {
  const setStoreHydrated = () => {
    const { hydrated, setHydrated } = useAutomationStore.getState();
    if (!hydrated) {
      setHydrated(true);
    }
  };

  useAutomationStore.persist.onFinishHydration(() => {
    setStoreHydrated();
  });

  if (useAutomationStore.persist.hasHydrated?.()) {
    setStoreHydrated();
  }
}
