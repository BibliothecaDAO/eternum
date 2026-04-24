import { MAX_RESOURCE_ALLOCATION_PERCENT, useAutomationStore } from "@/hooks/store/use-automation-store";
import { PROCESS_INTERVAL_MS } from "@/ui/features/infrastructure/automation/model/automation-processor";
import { calculatePresetAllocations, inferRealmPreset } from "@/utils/automation-presets";
import { aggregateConsumptionPerSecond, ResourceManager } from "@bibliothecadao/eternum";
import { useBuildings } from "@bibliothecadao/react";
import { ClientComponents, ResourcesIds, getProducedResource } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { useCallback, useMemo } from "react";

const EMPTY_MAP: Map<ResourcesIds, number> = new Map();

/**
 * Derives per-second consumption for each resource consumed by the configured
 * automation on a structure. Mirrors the aggregation shown inside the full automation
 * editor, so sidebar badges can render the same rates the editor would.
 */
export const useRealmConsumptionPerSecond = (
  structure: ComponentValue<ClientComponents["Structure"]["schema"]> | null | undefined,
  resources: ComponentValue<ClientComponents["Resource"]["schema"]> | null | undefined,
  structureEntityId: number | string | null | undefined,
): Map<ResourcesIds, number> => {
  const realmKey = useMemo(() => {
    if (structureEntityId === null || structureEntityId === undefined) return null;
    return String(structureEntityId);
  }, [structureEntityId]);

  const automationConfig = useAutomationStore(
    useCallback((state) => (realmKey ? state.realms[realmKey] : undefined), [realmKey]),
  );

  const coordX = Number(structure?.base?.coord_x ?? 0);
  const coordY = Number(structure?.base?.coord_y ?? 0);
  const buildings = useBuildings(coordX, coordY);

  const producedResourceIds = useMemo<ResourcesIds[]>(() => {
    if (!buildings?.length || !resources) return [];
    const unique = new Set<ResourcesIds>();
    buildings.forEach((building) => {
      if (!building) return;
      const producedResource = getProducedResource(building.category);
      if (!producedResource) return;
      if (producedResource === ResourcesIds.Labor) return;
      const resourceId = producedResource as ResourcesIds;
      const productionInfo = ResourceManager.balanceAndProduction(resources, resourceId);
      const hasActiveProduction = Number(productionInfo.production?.building_count ?? 0) > 0;
      if (!hasActiveProduction) return;
      unique.add(resourceId);
    });
    return Array.from(unique);
  }, [buildings, resources]);

  return useMemo(() => {
    if (!automationConfig) return EMPTY_MAP;
    if (producedResourceIds.length === 0) return EMPTY_MAP;

    const entityType = automationConfig.entityType ?? "realm";
    const presetId = inferRealmPreset(automationConfig);

    const percentagesByResource: Record<number, { resourceToResource: number; laborToResource: number }> = {};

    if (presetId === "custom") {
      // Custom preset uses the exact stored per-resource percentages; resources that
      // are produced but have no stored entry simply contribute nothing.
      producedResourceIds.forEach((resourceId) => {
        const stored = automationConfig.customPercentages?.[resourceId];
        if (stored) {
          percentagesByResource[resourceId] = stored;
        }
      });
    } else {
      const presetAllocations = calculatePresetAllocations(producedResourceIds, presetId, entityType);
      producedResourceIds.forEach((resourceId) => {
        const allocation = presetAllocations.get(resourceId);
        if (allocation) {
          percentagesByResource[resourceId] = allocation;
        }
      });
    }

    const cycleSeconds = PROCESS_INTERVAL_MS / 1000;
    const result = aggregateConsumptionPerSecond(producedResourceIds, percentagesByResource, {
      maxAllocationPercent: MAX_RESOURCE_ALLOCATION_PERCENT,
      cycleSeconds,
    });

    if (result.size === 0) return EMPTY_MAP;
    // Cast number keys to ResourcesIds for consistency with consumers.
    const typed = new Map<ResourcesIds, number>();
    result.forEach((value, key) => {
      typed.set(key as ResourcesIds, value);
    });
    return typed;
  }, [automationConfig, producedResourceIds]);
};
