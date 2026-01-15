import type { RealmPresetId } from "@/utils/automation-presets";
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
  customPercentages: Record<number, ResourceAutomationPercentages>;
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

type RealmAutomationInput = Partial<
  Omit<RealmAutomationConfig, "realmId" | "customPercentages" | "createdAt" | "updatedAt">
>;

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
  setResourcePercentages: (
    realmId: string,
    resourceId: ResourcesIds,
    percentages: Partial<ResourceAutomationPercentages>,
  ) => void;
  removeRealm: (realmId: string) => void;
  resetRealm: (realmId: string) => void;
  resetAll: () => void;
  setNextRunTimestamp: (timestamp: number | null) => void;
  recordExecution: (realmId: string, summary: RealmAutomationExecutionSummary) => void;
  getRealmConfig: (realmId: string) => RealmAutomationConfig | undefined;
  setHydrated: (value: boolean) => void;
  pruneForGame: (gameId: string) => void;
}

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > MAX_RESOURCE_ALLOCATION_PERCENT) return MAX_RESOURCE_ALLOCATION_PERCENT;
  return Math.round(value);
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
  if (preset === "smart" || preset === "idle" || preset === "custom") {
    return preset;
  }
  return "smart";
};

const sanitizeCustomPercentages = (
  percentages: Record<number, ResourceAutomationPercentages> | undefined,
  entityType: RealmEntityType = "realm",
): Record<number, ResourceAutomationPercentages> => {
  if (!percentages) return {};

  const sanitized: Record<number, ResourceAutomationPercentages> = {};

  Object.entries(percentages).forEach(([key, value]) => {
    if (!value) return;
    const resourceId = Number(key) as ResourcesIds;
    if (isAutomationResourceBlocked(resourceId, entityType)) return;

    sanitized[resourceId] = normalizePercentages(
      value as Partial<ResourceAutomationPercentages> & { resourceToLabor?: number },
      resourceId,
    );
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
              presetId: normalizePresetId(existing.presetId),
              customPercentages: sanitizeCustomPercentages(existing.customPercentages, existing.entityType),
            };
            const nextRealm: RealmAutomationConfig = metadataChanged
              ? {
                  ...sanitizedExisting,
                  realmName: data?.realmName ?? sanitizedExisting.realmName,
                  entityType: data?.entityType ?? sanitizedExisting.entityType,
                  autoBalance: data?.autoBalance ?? sanitizedExisting.autoBalance,
                  presetId: normalizePresetId(data?.presetId ?? sanitizedExisting.presetId),
                  updatedAt: now,
                }
              : sanitizedExisting;
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
            // Default to smart preset for new realms.
            presetId: normalizePresetId(data?.presetId ?? "smart"),
            customPercentages: {},
            createdAt: now,
            updatedAt: now,
          };
          return {
            realms: {
              ...state.realms,
              [realmId]: config,
            },
          };
        }),
      setRealmPreset: (realmId, presetId) =>
        set((state) => {
          const target = state.realms[realmId];
          if (!target) return state;

          const normalizedPreset = normalizePresetId(presetId);
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
                customPercentages: sanitizeCustomPercentages(
                  target.customPercentages,
                  metadata.entityType ?? target.entityType,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),
      setResourcePercentages: (realmId, resourceId, percentages) =>
        set((state) => {
          const realm = state.realms[realmId];
          if (!realm) return state;
          if (isAutomationResourceBlocked(resourceId, realm.entityType)) {
            return state;
          }

          const existingPercentages = realm.customPercentages?.[resourceId];
          const current = existingPercentages
            ? normalizePercentages(existingPercentages, resourceId)
            : normalizePercentages(undefined, resourceId);

          const updatedPercentages = normalizePercentages({ ...current, ...percentages }, resourceId);
          const changed =
            updatedPercentages.resourceToResource !== current.resourceToResource ||
            updatedPercentages.laborToResource !== current.laborToResource;

          if (!changed && existingPercentages) {
            return state;
          }

          const nextRealm: RealmAutomationConfig = {
            ...realm,
            presetId: "custom",
            customPercentages: sanitizeCustomPercentages(
              {
                ...realm.customPercentages,
                [resourceId]: updatedPercentages,
              },
              realm.entityType,
            ),
            updatedAt: Date.now(),
          };
          const nextState: Partial<ProductionAutomationState> = {
            realms: {
              ...state.realms,
              [realmId]: nextRealm,
            },
          };
          // quiet
          return nextState;
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
                customPercentages: {},
                presetId: "smart",
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
                customPercentages: sanitizeCustomPercentages(realm.customPercentages, realm.entityType),
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
          customPercentages: sanitizeCustomPercentages(realm.customPercentages, realm.entityType),
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
      version: 8,
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

          const realm = realmValue as any;
          const entityType: RealmEntityType = realm.entityType ?? "realm";

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
          let normalizedPreset: RealmPresetId = "smart";
          if (rawPreset === "smart" || rawPreset === "idle" || rawPreset === "custom") {
            normalizedPreset = rawPreset;
          } else if (rawPreset === "labor" || rawPreset === "resource") {
            normalizedPreset = "smart";
          } else if (rawPreset === null) {
            normalizedPreset = "custom";
          } else if (typeof rawPreset === "string") {
            normalizedPreset = "custom";
          }

          // Migrate legacy resources → customPercentages, preserving any saved values.
          const legacyResources = realm.resources as Record<number, any> | undefined;
          const incomingCustom = realm.customPercentages as Record<number, any> | undefined;

          let customPercentages: Record<number, ResourceAutomationPercentages> = {};
          if (incomingCustom && typeof incomingCustom === "object") {
            customPercentages = sanitizeCustomPercentages(incomingCustom, entityType);
          } else if (legacyResources && typeof legacyResources === "object") {
            const legacyPercentages: Record<number, ResourceAutomationPercentages> = {};
            Object.entries(legacyResources).forEach(([key, settings]) => {
              if (!settings) return;
              const resourceId = Number(key) as ResourcesIds;
              const percentages = (settings as any).percentages ?? settings;
              if (!percentages) return;
              legacyPercentages[resourceId] = {
                resourceToResource: Number((percentages as any).resourceToResource ?? 0),
                laborToResource: Number((percentages as any).laborToResource ?? 0),
              };
            });
            customPercentages = sanitizeCustomPercentages(legacyPercentages, entityType);
          }

          const { resources: _deprecatedResources, customPercentages: _deprecatedCustom, ...restRealm } = realm;

          nextRealms[realmId] = {
            ...restRealm,
            entityType,
            presetId: normalizedPreset,
            autoBalance: typeof restRealm.autoBalance === "boolean" ? restRealm.autoBalance : true,
            customPercentages,
            lastExecution: sanitizedLastExecution,
          } as RealmAutomationConfig;
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
