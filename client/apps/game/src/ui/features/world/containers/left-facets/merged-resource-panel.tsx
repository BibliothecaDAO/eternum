import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ProductionStatusBadge } from "@/ui/shared";
import { formatInventoryAmount } from "@/ui/features/world/components/entities/compact-entity-inventory";
import type { StructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { formatTimeRemaining } from "@/ui/features/economy/resources/entity-resource-table/utils";
import { resolveConstructionBuildability } from "@/ui/features/settlement/construction/construction-buildability";
import {
  buildRealmBuilding,
  resolveRealmHasAvailableBuildingTile,
} from "@/ui/features/settlement/construction/realm-build-actions";
import {
  beginRealmBuildPlacement,
  completeRealmBuildPlacement,
  getBuildReservationState,
  releaseOccupiedBuildSpot,
  reserveOccupiedBuildSpot,
} from "@/ui/features/settlement/construction/build-reservation-store";
import { divideByPrecision, getRealmInfo, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, getBuildingFromResource, type ID, ResourcesIds } from "@bibliothecadao/types";
import type { ClientComponents } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { ComponentValue } from "@dojoengine/recs";
import Plus from "lucide-react/dist/esm/icons/plus";

type ProductionItem = StructureProductionSummary["items"][number];

interface MergedResourcePanelProps {
  structureEntityId: ID;
  resources?: ComponentValue<ClientComponents["Resource"]["schema"]> | null;
  productionSummary: StructureProductionSummary;
  /** Show the build "+" action. Only meaningful for owned structures. */
  canBuild?: boolean;
}

/**
 * One panel that merges the old Production + Balance bubbles. Every relevant
 * resource is a single ProductionStatusBadge (the buildings-section token):
 *   top-left   = # production buildings   top-right = current balance
 *   bottom-left = production timer/ring    bottom-right = build "+"
 * The "+" reuses the exact build path from the build menu (buildRealmBuilding +
 * resolveConstructionBuildability + the reservation store), so it auto-builds
 * and is enabled only when the realm can afford the building. Tokens are split
 * into Resources / Military and ordered by the game's own tier order
 * (economic → T1 → T2 → T3).
 */
export const MergedResourcePanel = memo(({ structureEntityId, resources, productionSummary, canBuild = true }: MergedResourcePanelProps) => {
  const dojo = useDojo();
  const components = dojo.setup.components;
  const mode = useGameModeConfig();
  const currentDefaultTick = useCurrentDefaultTick();
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);

  const entityId = Number(structureEntityId);
  const realm = useMemo(
    () => (Number.isFinite(entityId) && entityId > 0 ? getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), components) : undefined),
    [entityId, components],
  );

  // 1s tick so production timers/rings decay live (same pattern as the
  // production panel + build menu).
  const [timerTick, setTimerTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => setTimerTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const currentTime = useMemo(() => Date.now(), [timerTick]);

  // Build-reservation refs, reset when the focused structure changes — mirrors
  // SelectPreviewBuildingMenu so the shared reservation store stays consistent.
  const occupiedSpotsRef = useRef<Set<string>>(getBuildReservationState(entityId).occupied);
  const vacatedSpotsRef = useRef<Set<string>>(getBuildReservationState(entityId).vacated);
  const [pendingBuilds, setPendingBuilds] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const reservation = getBuildReservationState(entityId);
    occupiedSpotsRef.current = reservation.occupied;
    vacatedSpotsRef.current = reservation.vacated;
    setPendingBuilds({});
  }, [entityId]);

  const balanceMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!resources) return map;
    const balances = ResourceManager.getResourceBalancesWithProduction(resources, currentDefaultTick);
    for (const balance of balances) {
      map.set(Number(balance.resourceId), divideByPrecision(Number(balance.amount)));
    }
    return map;
  }, [resources, currentDefaultTick]);

  const productionMap = useMemo(() => {
    const map = new Map<number, ProductionItem>();
    for (const item of productionSummary.items) {
      map.set(item.resourceId, item);
    }
    return map;
  }, [productionSummary]);

  // Group ids by the game's own tier order (insertion order is already
  // economic → transport → food → T1 → T2 → T3); split military out.
  const { resourceIds, militaryIds } = useMemo(() => {
    const tiers = mode.resources.getTiers() as Record<string, ResourcesIds[]>;
    const resourceList: ResourcesIds[] = [];
    let military: ResourcesIds[] = [];
    for (const [key, ids] of Object.entries(tiers)) {
      if (key === "military") {
        military = ids;
      } else {
        resourceList.push(...ids);
      }
    }
    return { resourceIds: resourceList, militaryIds: military };
  }, [mode]);

  const hasAvailableBuildingTile = useMemo(() => {
    if (!realm?.position) return true;
    return resolveRealmHasAvailableBuildingTile({
      entityId,
      realmPosition: realm.position,
      world: { components, systemCalls: dojo.setup.systemCalls },
      occupiedSpots: occupiedSpotsRef.current,
      vacatedSpots: vacatedSpotsRef.current,
    });
    // timerTick keeps this fresh as reservations/buildings change.
  }, [realm?.position, entityId, components, dojo.setup.systemCalls, timerTick]);

  const handleAutoBuild = useCallback(
    async (buildingType: BuildingType, resourceId: ResourcesIds) => {
      const buildingKey = buildingType.toString();
      const placement = beginRealmBuildPlacement(entityId, buildingType);
      if (!placement.started) return;

      setPendingBuilds((prev) => ({ ...prev, [buildingKey]: true }));
      try {
        await buildRealmBuilding({
          entityId,
          realmPosition: realm?.position,
          realm,
          mode,
          target: { type: buildingType, resource: resourceId },
          useSimpleCost,
          world: {
            account: dojo.account.account,
            components,
            systemCalls: dojo.setup.systemCalls,
          },
          occupiedSpots: occupiedSpotsRef.current,
          vacatedSpots: vacatedSpotsRef.current,
          onReserveSpot: (spotKey) => reserveOccupiedBuildSpot(entityId, spotKey),
          onReleaseSpot: (spotKey) => releaseOccupiedBuildSpot(entityId, spotKey),
        });
      } finally {
        setPendingBuilds((prev) => {
          const next = { ...prev };
          delete next[buildingKey];
          return next;
        });
        completeRealmBuildPlacement(entityId, buildingType);
      }
    },
    [dojo.account.account, dojo.setup.systemCalls, components, entityId, realm, mode, useSimpleCost],
  );

  const renderToken = useCallback(
    (resourceId: ResourcesIds) => {
      const item = productionMap.get(resourceId);
      const balance = balanceMap.get(resourceId) ?? 0;
      const building = getBuildingFromResource(resourceId);
      const isBuildable = building !== BuildingType.None;

      // Visibility: only resources you actually produce (a building exists) or
      // hold (balance > 0). Hide empties you've never touched, even if buildable.
      if (!item && balance <= 0) return null;

      const label = ResourcesIds[resourceId];
      const elapsedSeconds = item ? (currentTime - item.calculatedAt) / 1000 : 0;
      const effectiveRemaining =
        item && item.timeRemainingSeconds !== null ? Math.max(item.timeRemainingSeconds - elapsedSeconds, 0) : null;
      const timer =
        item?.isProducing && effectiveRemaining !== null ? formatTimeRemaining(Math.ceil(effectiveRemaining)) : undefined;
      const count = item && item.totalBuildings > 0 ? `${item.totalBuildings}` : undefined;
      const balanceLabel = balance > 0 ? formatInventoryAmount(balance) : undefined;

      let buildEnabled = false;
      let buildReason: string | undefined;
      if (isBuildable && canBuild) {
        const buildability = resolveConstructionBuildability({
          entityId,
          buildingType: building,
          useSimpleCost,
          components,
          realm,
          mode,
          hasAvailableBuildingTile,
        });
        buildReason = buildability.reason;
        buildEnabled = buildability.canSubmit && !pendingBuilds[building.toString()];
      }

      const tooltipParts = [label];
      if (item?.isProducing) {
        tooltipParts.push(`${item.activeBuildings}/${item.totalBuildings} producing`);
        if (timer) tooltipParts.push(`${timer} left`);
      } else if (count) {
        tooltipParts.push(`Idle (${item?.totalBuildings} building${item && item.totalBuildings !== 1 ? "s" : ""})`);
      }
      if (balanceLabel) tooltipParts.push(`${balanceLabel} held`);

      return (
        <div key={resourceId} className="relative inline-flex">
          <ProductionStatusBadge
            resourceLabel={label}
            tooltipText={tooltipParts.join(" • ")}
            isProducing={Boolean(item?.isProducing)}
            timeRemainingSeconds={effectiveRemaining}
            size="md"
            showTooltip
            cornerTopLeft={count}
            cornerTopRight={balanceLabel}
            cornerBottomRight={timer}
          />
          {isBuildable && canBuild && (
            <button
              type="button"
              disabled={!buildEnabled}
              onClick={(event) => {
                event.stopPropagation();
                if (!buildEnabled) return;
                void handleAutoBuild(building, resourceId);
              }}
              className={cn(
                "absolute -bottom-1 -left-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full border shadow-md transition",
                buildEnabled
                  ? "border-amber-500/80 bg-amber-400/90 text-black hover:bg-amber-300"
                  : "border-gold/20 bg-black/70 text-gold/40 cursor-not-allowed opacity-70",
              )}
              title={buildEnabled ? `Build ${label}` : (buildReason ?? "Cannot build")}
              aria-label={`Build ${label}`}
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      );
    },
    [
      balanceMap,
      canBuild,
      components,
      currentTime,
      entityId,
      handleAutoBuild,
      hasAvailableBuildingTile,
      mode,
      pendingBuilds,
      productionMap,
      realm,
      useSimpleCost,
    ],
  );

  // One flat grid — resources and military together (resources first, then the
  // troop resources), no section split.
  const tokens = useMemo(
    () => [...resourceIds, ...militaryIds].map(renderToken).filter(Boolean),
    [resourceIds, militaryIds, renderToken],
  );

  if (tokens.length === 0) {
    return <p className="text-xxs italic text-gold/60">No resources yet.</p>;
  }

  return <div className="flex flex-wrap items-center gap-3">{tokens}</div>;
});

MergedResourcePanel.displayName = "MergedResourcePanel";
