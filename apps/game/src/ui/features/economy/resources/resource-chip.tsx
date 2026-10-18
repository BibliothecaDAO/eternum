import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { relicLine } from "@/ui/features/relics/relic-words";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourceBurnPopover } from "@/ui/features/economy/resources/resource-burn-popover";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal";
import { CountUpNumber } from "@/ui/shared";
import { HudIconButton, HudRow } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { currencyFormat, currencyIntlFormat, knownBalance } from "@/ui/utils/utils";
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
  }, [resourceId]);

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
  // Each action keeps the app's named tip on hover, as before; the chip is the anchor it hangs from.
  const tipOn = (content: string) => (event: React.MouseEvent<HTMLElement>) =>
    setTooltip({ anchorElement: event.currentTarget, content, position: "bottom" });
  const tipOff = () => setTooltip(null);

  return (
    <div data-tooltip-anchor className="group" onMouseLeave={handleMouseLeave}>
      <HudRow
        lead={icon}
        title={
          <CountUpNumber
            value={balance}
            format={(v) => currencyFormat(v, 2)}
            className={cn("tabular-nums text-hud-strong", relicEffectActivated && "text-hud-accent")}
            highlightClassName="text-hud-good scale-105"
          />
        }
        detail={
          (relicEffectActivated || ratePerHour || (hasReachedMaxCap && amountProduced > 0n) || timeLeft) && (
            <span className="flex flex-wrap items-center gap-2">
              {relicEffectActivated && (
                <span
                  className="inline-flex items-center gap-1 text-hud-accent"
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setTooltip({
                      anchorElement: e.currentTarget,
                      position: "top",
                      content: `Relic effect expires in ${formatTime(relicTimeRemaining)}`,
                    });
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setTooltip(null);
                  }}
                >
                  <SemanticIcon name="relics" className="h-3 w-3" />
                  {formatTime(relicTimeRemaining)}
                </span>
              )}
              {ratePerHour && <span className="tabular-nums text-hud-good">{ratePerHour}</span>}
              {hasReachedMaxCap && amountProduced > 0n && <span className="text-hud-warn">Max</span>}
              {timeLeft && <span className="text-hud-cue">{timeLeft}</span>}
            </span>
          )
        }
        trail={
          <>
            {canShowProductionShortcut && (
              <HudIconButton
                icon="production"
                label="Manage production"
                kind="quiet"
                size="sm"
                disabled={disableButtons}
                onMouseEnter={tipOn("Manage Production")}
                onMouseLeave={tipOff}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenProduction();
                }}
              />
            )}
            {canOpenCraftRelic && (
              <HudIconButton
                icon="research"
                label="Craft relic from research"
                kind="quiet"
                size="sm"
                disabled={disableButtons}
                onMouseEnter={tipOn("Craft Relic from Research")}
                onMouseLeave={tipOff}
                onClick={(event) => {
                  event.stopPropagation();
                  const anchor = surfaceAnchorFrom(event.currentTarget);
                  import("./craft-relic-popup").then(({ CraftRelicPopup }) => {
                    openSurface({
                      id: "craft-relic",
                      content: <CraftRelicPopup structureId={resourceManager.entityId} onClose={closeSurface} />,
                      anchor,
                    });
                  });
                }}
              />
            )}
            {showTransfer && (
              <HudIconButton
                icon="swap"
                label={`Transfer ${resourceName}`}
                title="Transfer"
                kind="quiet"
                size="sm"
                disabled={disableButtons}
                onClick={(event) => {
                  event.stopPropagation();
                  openTransfer({ sourceId: resourceManager.entityId, destinationIds: [], resource: resourceId });
                }}
              />
            )}
            {showTransfer && (balance ?? 0) > 0 && (
              <ResourceBurnPopover
                structureId={resourceManager.entityId}
                resourceId={resourceEnumId}
                trigger={(toggle) => (
                  <HudIconButton
                    icon="flame"
                    label={`Burn ${resourceName}`}
                    title="Burn"
                    kind="quiet"
                    size="sm"
                    disabled={disableButtons}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle();
                    }}
                  />
                )}
              />
            )}
            {isRelic && balance > 0 && (
              <HudIconButton
                icon="relics"
                label={`Activate ${resourceName}`}
                kind="quiet"
                size="sm"
                disabled={disableButtons || relicTimeRemaining > 0}
                onMouseEnter={tipOn(
                  `Activate · ${relicLine(resourceId, knownBalance(resourceManager.balance(ResourcesIds.Essence)))}`,
                )}
                onMouseLeave={tipOff}
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
              />
            )}
          </>
        }
      />
    </div>
  );
};
