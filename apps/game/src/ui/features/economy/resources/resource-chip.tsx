import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourceBurnPopover } from "@/ui/features/economy/resources/resource-burn-popover";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal";
import { CountUpNumber } from "@/ui/shared";
import { HUD_CUE, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import {
  bonusActive,
  configManager,
  divideByPrecision,
  formatTime,
  isRelic as isResourceRelic,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useNativeRevision, useNativeRow } from "@/hooks/helpers/use-native-facts";
import {
  findResourceById,
  ID,
  RelicEffect,
  RelicRecipientType,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  size = "default",
  hideZeroBalance = false,
  showTransfer = true,
  storageCapacity = 0,
  storageCapacityUsed = 0,
  activeRelicEffects,
  canOpenProduction = false,
  disableButtons = false,
  onManageProduction,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  size?: "default" | "large";
  hideZeroBalance?: boolean;
  showTransfer?: boolean;
  storageCapacity?: number;
  storageCapacityUsed?: number;
  activeRelicEffects: RelicEffect[];
  canOpenProduction?: boolean;
  disableButtons?: boolean;
  onManageProduction?: (resourceId: ResourcesIds) => void;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const revision = useNativeRevision(["ResourceBalance", "ResourceProduction", "ResourceWeight", "ProductionBonus"]);
  const structure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: resourceManager.entityId,
  });

  const now = useCurrentDefaultTick();
  const resourceEnumId = resourceId as ResourcesIds;
  const resourceName = findResourceById(resourceEnumId)?.trait ?? "resource";

  // Undefined when this client holds no resource owner for the structure: the chip then shows nothing.
  const production = useMemo(
    () => resourceManager.balanceWithProduction(now, resourceEnumId),
    [resourceManager, now, resourceEnumId, revision],
  );
  const balance = production?.balance;
  const productionInfo = useMemo(
    () => resourceManager.current(resourceEnumId),
    [resourceManager, resourceEnumId, revision],
  );

  const productionData = useMemo(() => {
    if (!productionInfo) return null;

    return ResourceManager.calculateResourceProductionData(resourceEnumId, productionInfo, now);
  }, [productionInfo, resourceEnumId, now]);

  const productionRate = productionData?.productionPerSecond ?? 0;
  const isProducing = productionData?.isProducing ?? false;

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(now, resourceId);
  }, [resourceManager, now]);

  const icon = useMemo(() => {
    return <ResourceIcon withTooltip={false} resource={resourceId} size="sm" className="self-center" />;
  }, [resourceId, size]);

  const handleMouseLeave = useCallback(() => setTooltip(null), [setTooltip]);

  const canShowProductionShortcut = useMemo(() => {
    if (!canOpenProduction) return false;
    if (!resourceId && resourceId !== 0) return false;
    return configManager.canRefillProduction(resourceId);
  }, [canOpenProduction, resourceId]);

  const canOpenCraftRelic = useMemo(() => {
    if (resourceEnumId !== ResourcesIds.Research || !balance || balance <= 0) {
      return false;
    }

    const structureCategory = structure?.base.category;

    return structureCategory === StructureType.Realm || structureCategory === StructureType.Village;
  }, [balance, structure, resourceEnumId]);

  const handleOpenProduction = useCallback(() => {
    if (!canShowProductionShortcut) return;

    if (onManageProduction) {
      onManageProduction(resourceId as ResourcesIds);
      return;
    }

    if (!resourceManager?.entityId) return;
    openSurface({
      id: "production",
      content: (
        <ProductionModal
          preSelectedRealmId={resourceManager.entityId}
          preSelectedResource={resourceId as ResourcesIds}
        />
      ),
    });
  }, [canShowProductionShortcut, onManageProduction, resourceManager, resourceId, openSurface]);

  // Check if this resource is a relic
  const isRelic = useMemo(() => {
    // Using type assertion until the build system picks up the new method
    return isResourceRelic(resourceId);
  }, [resourceManager, resourceId]);

  // todo: check relic effect active
  const relicEffectActivated = useMemo(() => {
    return activeRelicEffects.some((effect) => effect.id === resourceId && bonusActive(effect.endAt, now));
  }, [activeRelicEffects, resourceId, now]);

  // Calculate time remaining for active relic with real-time countdown
  const relicTimeRemaining = useMemo(() => {
    if (!isRelic || !relicEffectActivated) return 0;

    const relicEffect = activeRelicEffects.find((effect) => effect.id === resourceId);
    return relicEffect ? Math.max(0, relicEffect.endAt - now) : 0;
  }, [isRelic, relicEffectActivated, activeRelicEffects, resourceId, now]);

  // Check if we should hide this resource based on the balance and hideZeroBalance prop
  // Show relics with active effects even if balance is 0
  if (!production || balance === undefined) return null;
  const { hasReachedMaxCapacity: hasReachedMaxCap, amountProduced } = production;
  if (hideZeroBalance && balance <= 0 && !(isRelic && relicEffectActivated)) {
    return null;
  }
  const ratePerHour = isProducing && !hasReachedMaxCap ? `+${currencyIntlFormat(productionRate * 60 * 60, 4)}/h` : null;
  const timeLeft =
    timeUntilValueReached > 0 && timeUntilValueReached <= 1_000_000_000 ? formatTime(timeUntilValueReached) : null;
  const actionButton =
    "rounded p-1 text-gold/80 transition hover:bg-gold/15 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      data-tooltip-anchor
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-gold/15 bg-black/25 transition hover:border-gold/35",
        size === "large" ? "px-3 py-2" : "px-2 py-1.5",
        relicEffectActivated && "animate-pulse border-purple-500/50 bg-purple-500/20",
      )}
      onMouseLeave={handleMouseLeave}
    >
      {icon}
      <CountUpNumber
        value={balance}
        format={(v) => currencyFormat(v, 2)}
        className={cn(HUD_VALUE, "tabular-nums", relicEffectActivated && "text-relic")}
        highlightClassName="text-green font-bold scale-105"
      />
      {relicEffectActivated && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-relic2"
          onMouseEnter={(e) => {
            e.stopPropagation();
            setTooltip({
              anchorElement: e.currentTarget,
              position: "top",
              content: <span className="text-sm">Relic effect expires in {formatTime(relicTimeRemaining)}</span>,
            });
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            setTooltip(null);
          }}
        >
          <SemanticIcon name="relics" className="h-3 w-3 animate-pulse" />
          {formatTime(relicTimeRemaining)}
        </span>
      )}
      {ratePerHour && <span className="text-[10px] font-semibold tabular-nums text-emerald-300">{ratePerHour}</span>}
      {hasReachedMaxCap && amountProduced > 0n && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Max</span>
      )}
      {timeLeft && <span className={cn(HUD_CUE, "tracking-normal")}>{timeLeft}</span>}
      <span className="ml-auto" />
      {canShowProductionShortcut && (
        <button
          data-tooltip-anchor
          aria-label="Manage production"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenProduction();
          }}
          onMouseEnter={(event) =>
            setTooltip({
              anchorElement: event.currentTarget,
              content: "Manage Production",
              position: "bottom",
            })
          }
          onMouseLeave={() => setTooltip(null)}
          disabled={disableButtons}
          className={actionButton}
        >
          <SemanticIcon name="production" className="h-4 w-4" />
        </button>
      )}
      {canOpenCraftRelic && (
        <button
          data-tooltip-anchor
          onClick={(event) => {
            event.stopPropagation();
            import("./craft-relic-popup").then(({ CraftRelicPopup }) => {
              openSurface({
                id: "craft-relic",
                content: <CraftRelicPopup structureId={resourceManager.entityId} onClose={closeSurface} />,
                anchor: surfaceAnchorFrom(event.currentTarget),
              });
            });
          }}
          onMouseEnter={(event) =>
            setTooltip({
              anchorElement: event.currentTarget,
              content: "Craft Relic from Research",
              position: "bottom",
            })
          }
          onMouseLeave={() => setTooltip(null)}
          disabled={disableButtons}
          title="Craft relic from research"
          aria-label="Craft relic from research"
          className={cn(actionButton, "border border-relic/35 bg-relic/10 text-relic2 hover:bg-relic/20")}
        >
          <SemanticIcon name="research" className="h-4 w-4" />
        </button>
      )}
      {showTransfer && (
        <button
          data-tooltip-anchor
          type="button"
          aria-label={`Transfer ${resourceName}`}
          title="Transfer"
          onClick={(event) => {
            event.stopPropagation();
            openTransfer({ sourceId: resourceManager.entityId, destinationIds: [], resource: resourceId });
          }}
          disabled={disableButtons}
          className={actionButton}
        >
          <SemanticIcon name="swap" className="h-4 w-4" />
        </button>
      )}
      {showTransfer && (balance ?? 0) > 0 && (
        <ResourceBurnPopover
          structureId={resourceManager.entityId}
          resourceId={resourceEnumId}
          trigger={(toggle) => (
            <button
              data-tooltip-anchor
              type="button"
              aria-label={`Burn ${resourceName}`}
              title="Burn"
              onClick={(event) => {
                event.stopPropagation();
                toggle();
              }}
              disabled={disableButtons}
              className={actionButton}
            >
              <SemanticIcon name="flame" className="h-4 w-4" />
            </button>
          )}
        />
      )}
      {isRelic && balance > 0 && (
        <button
          data-tooltip-anchor
          onClick={(event) => {
            event.stopPropagation();
            import("./relic-activation-popup").then(({ RelicActivationPopup }) => {
              openSurface({
                id: "relic-activation",
                content: (
                  <RelicActivationPopup
                    entityId={resourceManager.entityId}
                    entityOwnerId={resourceManager.entityId}
                    recipientType={RelicRecipientType.Structure}
                    relicId={resourceId}
                    relicBalance={divideByPrecision(balance)}
                    onClose={closeSurface}
                  />
                ),
              });
            });
          }}
          disabled={disableButtons || relicTimeRemaining > 0}
          onMouseEnter={(event) =>
            setTooltip({
              anchorElement: event.currentTarget,
              content: "Activate Relic",
              position: "bottom",
            })
          }
          onMouseLeave={() => setTooltip(null)}
          className={actionButton}
        >
          <SemanticIcon name="relics" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
