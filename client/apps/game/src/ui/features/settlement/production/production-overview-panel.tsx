import { isAutomationResourceBlocked, useAutomationStore } from "@/hooks/store/use-automation-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionModal } from "@/ui/features/settlement";
import { REALM_PRESETS, RealmPresetId, inferRealmPreset } from "@/utils/automation-presets";
import { getIsBlitz, getStructureName, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useEffect, useMemo } from "react";

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(timestamp);
};

const formatRelative = (timestamp?: number) => {
  if (!timestamp) return "—";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatAmount = (amount: number | undefined) => {
  if (!amount || Number.isNaN(amount)) return "0";
  return Math.round(amount).toLocaleString();
};

const formatMethodLabel = (method?: string) => {
  switch (method) {
    case "resource-to-resource":
      return "Resource burn";
    case "labor-to-resource":
      return "Labor burn";
    default:
      return "Production";
  }
};

type RealmCard = {
  id: string;
  name: string;
  type: string;
  resourceIds: ResourcesIds[];
  lastRun?: number;
  presetId: RealmPresetId;
  productionLookup: Record<
    number,
    { produced: number; cycles: number; method: string; executedAt: number } | undefined
  >;
};

export const ProductionOverviewPanel = () => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const automationRealms = useAutomationStore((state) => state.realms);
  const upsertRealm = useAutomationStore((state) => state.upsertRealm);
  const removeRealm = useAutomationStore((state) => state.removeRealm);
  const hydrated = useAutomationStore((state) => state.hydrated);

  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const {
    setup: { components },
  } = useDojo();
  const isBlitz = getIsBlitz();

  useEffect(() => {
    if (!hydrated) return;
    const managedStructures = [...playerRealms, ...playerVillages];
    const activeIds = new Set(managedStructures.map((structure) => String(structure.entityId)));

    // If we don't yet have any structures, skip pruning to avoid wiping store during data load.
    if (managedStructures.length === 0) {
      return;
    }

    managedStructures.forEach((structure) => {
      const entityType = structure.structure?.category === StructureType.Village ? "village" : "realm";
      const structureName = getStructureName(structure.structure, isBlitz).name;

      upsertRealm(String(structure.entityId), {
        realmName: structureName,
        entityType,
      });
    });

    Object.entries(useAutomationStore.getState().realms).forEach(([realmId, config]) => {
      const supportedType = config.entityType === "realm" || config.entityType === "village";
      if (!supportedType || !activeIds.has(realmId)) {
        removeRealm(realmId);
      }
    });
  }, [isBlitz, playerRealms, playerVillages, removeRealm, upsertRealm, hydrated]);

  const realmCards = useMemo<RealmCard[]>(() => {
    const cards: RealmCard[] = [];
    const managedStructures = [...playerRealms, ...playerVillages];
    managedStructures.forEach((realm) => {
      const automation = automationRealms[String(realm.entityId)];
      const realmName = getStructureName(realm.structure, isBlitz).name;
      const producedResources = automation?.resources ?? {};
      const entityType = automation?.entityType ?? "realm";

      // Derive produced resources from live game state (buildings) to enable presets
      // even before any automation resources are configured.
      let producedFromBuildings: ResourcesIds[] = [];
      try {
        const realmIdNum = Number(realm.entityId);
        if (components && Number.isFinite(realmIdNum) && realmIdNum > 0) {
          const resourceManager = new ResourceManager(components, realmIdNum);
          const resourceComponent = resourceManager.getResource();
          if (resourceComponent) {
            const ALL = Object.values(ResourcesIds).filter((v) => typeof v === "number") as ResourcesIds[];
            for (const resId of ALL) {
              const prod = ResourceManager.balanceAndProduction(resourceComponent, resId).production;
              if (prod && prod.building_count > 0) {
                producedFromBuildings.push(resId);
              }
            }
          }
        }
      } catch (_e) {
        // ignore
      }

      const configuredIds = Object.keys(producedResources).map((key) => Number(key) as ResourcesIds);
      const unionIds = Array.from(new Set([...configuredIds, ...producedFromBuildings]))
        .filter((resourceId) => !isAutomationResourceBlocked(resourceId, entityType))
        .sort((a, b) => a - b)
        .slice(0, 8);

      const lastExecution = automation?.lastExecution;

      const productionLookup: Record<
        number,
        { produced: number; cycles: number; method: string; executedAt: number } | undefined
      > = {};

      if (lastExecution) {
        const mergedExecutions = [
          ...(lastExecution.resourceToResource ?? []),
          ...(lastExecution.laborToResource ?? []),
        ].filter((entry) => entry && entry.resourceId !== undefined);

        mergedExecutions.forEach((entry) => {
          const key = entry.resourceId;
          productionLookup[key] = {
            produced: entry.produced,
            cycles: entry.cycles,
            method: entry.method,
            executedAt: lastExecution.executedAt,
          };
        });
      }

      cards.push({
        id: String(realm.entityId),
        name: realmName,
        type: entityType,
        resourceIds: unionIds,
        lastRun: automation?.lastExecution?.executedAt,
        presetId: inferRealmPreset(automation) ?? "custom",
        productionLookup,
      });

      // quiet
    });

    return cards.sort((a, b) => a.name.localeCompare(b.name));
  }, [automationRealms, isBlitz, playerRealms, playerVillages]);

  const globalPreset = useMemo<RealmPresetId | "mixed">(() => {
    if (realmCards.length === 0) return "custom";
    const presets = new Set(realmCards.map((card) => card.presetId));
    if (presets.size === 1) {
      const [singlePreset] = Array.from(presets);
      return singlePreset ?? "custom";
    }
    return "mixed";
  }, [realmCards]);

  const globalPresetLabel = useMemo(() => {
    if (globalPreset === "mixed") return "Mixed presets";
    const preset = REALM_PRESETS.find((item) => item.id === globalPreset);
    return preset?.label ?? "Custom";
  }, [globalPreset]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-gold">Production Overview</h4>
          <p className="text-[11px] text-gold/60">
            Review automation status across your realms. Use Modify to adjust allocations in the advanced panel.
          </p>
        </div>
        <Button variant="outline" size="xs" onClick={() => toggleModal(<ProductionModal />)}>
          Modify
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gold/60">Current global preset</span>
        <span className="inline-flex w-fit rounded border border-gold/30 bg-black/30 px-2 py-1 text-[11px] uppercase tracking-wide text-gold/80">
          {globalPresetLabel}
        </span>
        {globalPreset === "mixed" && (
          <span className="text-[10px] text-gold/60">Different presets are active across your realms.</span>
        )}
      </div>

      {realmCards.length === 0 ? (
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          No production configured yet. Use Modify to set up automation.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {realmCards.map((card) => (
            <div key={card.id} className="rounded border border-gold/10 bg-black/20 p-3 text-xs text-gold/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gold/90">{card.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-gold/50">{card.type}</span>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-gold/60 whitespace-nowrap">Realm preset</span>
                  <span className="rounded border border-gold/20 bg-black/30 px-2 py-1 text-[11px] uppercase tracking-wide text-gold/80">
                    {REALM_PRESETS.find((preset) => preset.id === card.presetId)?.label ?? "Custom"}
                  </span>
                </div>
                <span
                  className="text-[10px] text-gold/50 whitespace-nowrap"
                  title={`Latest run: ${formatTimestamp(card.lastRun)}`}
                >
                  Latest run {formatRelative(card.lastRun)}
                </span>
              </div>

              {card.resourceIds.length === 0 ? (
                <span className="text-[11px] text-gold/50">No automated resources</span>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {card.resourceIds.map((resourceId) => {
                    const detail = card.productionLookup[resourceId];
                    return (
                      <div
                        key={`${card.id}-${resourceId}`}
                        className="flex items-start gap-2 rounded border border-gold/15 bg-black/30 px-2 py-2"
                      >
                        <ResourceIcon resource={ResourcesIds[resourceId]} size="xs" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-gold/80">{ResourcesIds[resourceId]}</span>
                          <span className="text-[10px] text-gold/60">
                            {detail ? (
                              <>
                                {formatAmount(detail.produced)} output &middot; {detail.cycles} cycles &middot;{" "}
                                {formatMethodLabel(detail.method)} &middot; {formatRelative(detail.executedAt)}
                              </>
                            ) : (
                              "No recent production data"
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
