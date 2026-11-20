import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { openProduction } from "@/ui/features/settlement/production/open-production";
import { CountUpNumber } from "@/ui/shared";
import { HudIconButton, HudRow } from "@/ui/design-system/kit/hud-elements";
import { knownAmount } from "@/ui/utils/utils";
import { configManager, ResourceManager } from "@bibliothecadao/eternum";
import { ID, ResourcesIds, formatWait, formatAmount, formatRate, resourceName } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";

export const ResourceChip = ({
  resourceId,
  resourceManager,
  hideZeroBalance = false,
  showTransfer = true,
  canOpenProduction = false,
  disableButtons = false,
  onManageProduction,
}: {
  resourceId: ID;
  /** From useResourceManager: a new manager each time its facts change, so the chip's reads follow it. */
  resourceManager: ResourceManager;
  hideZeroBalance?: boolean;
  showTransfer?: boolean;
  canOpenProduction?: boolean;
  disableButtons?: boolean;
  onManageProduction?: (resourceId: ResourcesIds) => void;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);

  const now = useCurrentDefaultTick();
  const resourceEnumId = resourceId as ResourcesIds;
  const name = resourceName(resourceEnumId);

  // Undefined when this client holds no resource owner for the structure: the chip then shows nothing.
  const production = useMemo(
    () => resourceManager.balanceWithProduction(now, resourceEnumId),
    [resourceManager, now, resourceEnumId],
  );
  const balance = production?.balance;
  const productionData = useMemo(
    () => resourceManager.productionData(resourceEnumId, now),
    [resourceManager, resourceEnumId, now],
  );

  const productionRate = productionData?.productionPerSecond ?? 0;
  const isProducing = productionData?.isProducing ?? false;

  const timeUntilValueReached = productionData?.timeRemainingSeconds;

  const icon = useMemo(() => {
    return <ResourceIcon withTooltip={false} resource={resourceId} size="sm" className="self-center" />;
  }, [resourceId]);

  const handleMouseLeave = useCallback(() => setTooltip(null), [setTooltip]);

  const canShowProductionShortcut = useMemo(() => {
    if (!canOpenProduction) return false;
    if (!resourceId && resourceId !== 0) return false;
    return configManager.canRefillProduction(resourceId);
  }, [canOpenProduction, resourceId]);

  const handleOpenProduction = useCallback(() => {
    if (!canShowProductionShortcut) return;

    if (onManageProduction) {
      onManageProduction(resourceId as ResourcesIds);
      return;
    }

    if (!resourceManager?.entityId) return;
    openProduction({ realmId: resourceManager.entityId, resource: resourceId as ResourcesIds });
  }, [canShowProductionShortcut, onManageProduction, resourceManager, resourceId]);

  if (!production || balance === undefined) return null;
  const { hasReachedMaxCapacity: hasReachedMaxCap, amountProduced } = production;
  if (hideZeroBalance && balance <= 0) {
    return null;
  }
  const ratePerHour = isProducing && !hasReachedMaxCap ? formatRate(productionRate) : null;
  const timeLeft =
    timeUntilValueReached !== undefined && timeUntilValueReached > 0 && Number.isFinite(timeUntilValueReached)
      ? formatWait(timeUntilValueReached)
      : null;
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
            format={(v) => formatAmount(knownAmount(v))}
            className="tabular-nums text-hud-strong"
            highlightClassName="text-hud-good scale-105"
          />
        }
        detail={
          (ratePerHour || (hasReachedMaxCap && amountProduced > 0n) || timeLeft) && (
            <span className="flex flex-wrap items-center gap-2">
              {ratePerHour && <span className="tabular-nums text-hud-good">{ratePerHour}</span>}
              {hasReachedMaxCap && amountProduced > 0n && <span className="text-hud-warn">Max</span>}
              {timeLeft && <span className="text-hud-cue">{timeLeft}</span>}
            </span>
          )
        }
        controls={
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
            {showTransfer && (
              <HudIconButton
                icon="swap"
                label={`Transfer ${name}`}
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
          </>
        }
      />
    </div>
  );
};
