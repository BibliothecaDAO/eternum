import { memo, useCallback, useMemo, useRef } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick, useNowMs } from "@/hooks/helpers/use-block-timestamp";
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
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { divideByPrecision, getRealmInfo, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  BuildingType,
  EntityType,
  getBuildingFromResource,
  type ID,
  isRelic,
  RelicRecipientType,
  ResourcesIds,
} from "@bibliothecadao/types";
import type { ClientComponents } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import type { ComponentValue } from "@dojoengine/recs";
import Plus from "lucide-react/dist/esm/icons/plus";
import { gameEntityKey } from "@bibliothecadao/eternum/game-client";

type ProductionItem = StructureProductionSummary["items"][number];

const ACCRUAL_SWEEP_INTERVAL_MS = 60_000;

interface MergedResourcePanelProps {
  structureEntityId: ID;
  resources?: ComponentValue<ClientComponents["Resource"]["schema"]> | null;
  productionSummary: StructureProductionSummary;
  /** Show the build "+" action. Only meaningful for owned structures. */
  canBuild?: boolean;
  /** Owned structures can activate held relics from the dedicated relic row. */
  isMine?: boolean;
  /** Currently-active relic effect ids, so the relic row can flag them. */
  activeRelicIds?: number[];
}

/**
 * One panel that merges the old Production + Balance bubbles. Every relevant
 * resource is a single ProductionStatusBadge (the buildings-section token):
 *   top-left   = # production buildings   top-right = current balance
 *   bottom-left = production timer/ring    bottom-right = build "+"
 * The "+" reuses the exact build path from the build menu (buildRealmBuilding +
 * resolveConstructionBuildability), so it auto-builds
 * and is enabled only when the realm can afford the building. Tokens are split
 * into Resources / Military and ordered by the game's own tier order
 * (economic → T1 → T2 → T3).
 */
export const MergedResourcePanel = memo(
  ({
    structureEntityId,
    resources,
    productionSummary,
    canBuild = true,
    isMine = false,
    activeRelicIds,
  }: MergedResourcePanelProps) => {
    const dojo = useDojo();
    const components = dojo.setup.components;
    const mode = useGameModeConfig();
    const currentDefaultTick = useCurrentDefaultTick();
    const useSimpleCost = useUIStore((state) => state.useSimpleCost);

    const entityId = Number(structureEntityId);
    const realm = useMemo(
      () =>
        Number.isFinite(entityId) && entityId > 0
          ? getRealmInfo(gameEntityKey([BigInt(entityId)]), components)
          : undefined,
      [entityId, components],
    );

    // 1s tick so production timers/rings decay live (same pattern as the
    // production panel + build menu).
    const currentTime = useNowMs();

    // Production accrues every tick, so the held amount changes every second. One sweep per token per
    // minute, automation's own cadence, is the most a player should see.
    const accrualSweeps = useRef(new Map<ResourcesIds, { label: string | undefined; at: number; key: number }>());
    const resolveAccrualKey = (resourceId: ResourcesIds, label: string | undefined): number => {
      const previous = accrualSweeps.current.get(resourceId);
      if (!previous) {
        accrualSweeps.current.set(resourceId, { label, at: currentTime, key: 0 });
        return 0;
      }
      if (label === previous.label || currentTime - previous.at < ACCRUAL_SWEEP_INTERVAL_MS) {
        previous.label = label;
        return previous.key;
      }
      const next = { label, at: currentTime, key: previous.key + 1 };
      accrualSweeps.current.set(resourceId, next);
      return next.key;
    };

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
    // economic → transport → food → T1 → T2 → T3); split military out. Relics
    // are excluded entirely — they get their own dedicated row above the grid.
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
      return { resourceIds: resourceList.filter((id) => !isRelic(id)), militaryIds: military };
    }, [mode]);

    // Whether the structure holds any relic, so an empty token grid still keeps
    // the panel (and its relic row) visible.
    const hasRelics = useMemo(() => {
      for (const [id, balance] of balanceMap) {
        if (balance > 0 && isRelic(id)) return true;
      }
      return false;
    }, [balanceMap]);

    const hasAvailableBuildingTile = useMemo(() => {
      if (!realm?.position) return true;
      return resolveRealmHasAvailableBuildingTile({
        entityId,
        realmPosition: realm.position,
      });
      // the clock keeps this fresh as synced building occupancy changes.
    }, [realm?.position, entityId, currentTime]);

    const handleAutoBuild = useCallback(
      async (buildingType: BuildingType, resourceId: ResourcesIds) => {
        await buildRealmBuilding({
          entityId,
          realmPosition: realm?.position,
          realm,
          mode,
          target: { type: buildingType, resource: resourceId },
          useSimpleCost,
        });
      },
      [entityId, realm, mode, useSimpleCost],
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
        // Whole minutes only: automation refills inputs every minute, so seconds are noise and anything
        // under a minute is the normal state of a topped-up resource, not a warning.
        const timer =
          item?.isProducing && effectiveRemaining !== null && effectiveRemaining >= 60
            ? formatTimeRemaining(Math.ceil(effectiveRemaining / 60) * 60)
            : undefined;
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
          buildEnabled = buildability.canSubmit;
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
          <div key={resourceId} className="relative inline-flex h-12 w-12 shrink-0">
            <ProductionStatusBadge
              resourceLabel={label}
              tooltipText={tooltipParts.join(" • ")}
              isProducing={Boolean(item?.isProducing)}
              timeRemainingSeconds={effectiveRemaining}
              size="sm"
              showTooltip
              cornerTopLeft={count}
              cornerTopRight={balanceLabel}
              cornerBottomRight={timer}
              accrualKey={resolveAccrualKey(resourceId, balanceLabel)}
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

    if (tokens.length === 0 && !hasRelics) {
      return <p className="text-xxs italic text-gold/60">No resources yet.</p>;
    }

    // Relics first, on their own dedicated, clickable row. Then the resource +
    // military token grid, left-aligned.
    return (
      <div className="flex flex-col gap-2">
        {hasRelics && (
          <CompactEntityInventory
            resources={resources}
            activeRelicIds={activeRelicIds}
            recipientType={RelicRecipientType.Structure}
            entityId={structureEntityId}
            entityType={EntityType.STRUCTURE}
            allowRelicActivation={isMine}
            variant="tight"
            filter="relics"
            emptyMessage=""
            showHiddenCount={false}
          />
        )}
        {tokens.length > 0 && (
          // Two token rows stay visible; more scroll inside. The inner padding keeps rings and badges off the clip edge.
          <div className="max-h-[164px] overflow-y-auto overscroll-contain">
            <div className="flex max-w-full flex-wrap justify-start gap-x-4 gap-y-5 px-5 pb-3 pt-3">{tokens}</div>
          </div>
        )}
      </div>
    );
  },
);

MergedResourcePanel.displayName = "MergedResourcePanel";
