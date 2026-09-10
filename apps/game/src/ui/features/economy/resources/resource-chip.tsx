import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourceTransferPopover } from "@/ui/features/economy/resources/resource-transfer-popover";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal";
import { CountUpNumber } from "@/ui/shared";
import { HUD_CUE, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";
import {
  configManager,
  divideByPrecision,
  formatTime,
  isRelic as isResourceRelic,
  relicsArmiesTicksLeft,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useDojo } from "@bibliothecadao/react";
import {
  ID,
  RelicEffectWithEndTick,
  RelicRecipientType,
  ResourcesIds,
  StructureType,
  TickIds,
} from "@bibliothecadao/types";
import Factory from "lucide-react/dist/esm/icons/factory";
import FlaskConical from "lucide-react/dist/esm/icons/flask-conical";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { gameEntityKey } from "@/sync/game-scope";

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
  currentDefaultTick: currentDefaultTickProp,
  currentArmiesTick: currentArmiesTickProp,
  armiesTickTimeRemaining: armiesTickTimeRemainingProp,
}: {
  resourceId: ID;
  resourceManager: ResourceManager;
  size?: "default" | "large";
  hideZeroBalance?: boolean;
  showTransfer?: boolean;
  storageCapacity?: number;
  storageCapacityUsed?: number;
  activeRelicEffects: RelicEffectWithEndTick[];
  canOpenProduction?: boolean;
  disableButtons?: boolean;
  onManageProduction?: (resourceId: ResourcesIds) => void;
  currentDefaultTick?: number;
  currentArmiesTick?: number;
  armiesTickTimeRemaining?: number;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const {
    setup: { components },
  } = useDojo();
  const [balance, setBalance] = useState(0);
  const [amountProduced, setAmountProduced] = useState(0n);
  const [amountProducedLimited, setAmountProducedLimited] = useState(0n);
  const [hasReachedMaxCap, setHasReachedMaxCap] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(0);

  const storeDefaultTick = useBlockTimestampStore((state) => state.currentDefaultTick);
  const storeArmiesTick = useBlockTimestampStore((state) => state.currentArmiesTick);
  const storeArmiesTickTimeRemaining = useBlockTimestampStore((state) => state.armiesTickTimeRemaining);

  const currentDefaultTick = currentDefaultTickProp ?? storeDefaultTick;
  const currentArmiesTick = currentArmiesTickProp ?? storeArmiesTick;
  const armiesTickTimeRemaining = armiesTickTimeRemainingProp ?? storeArmiesTickTimeRemaining;
  const currentTick = currentDefaultTick || 0;
  const resourceEnumId = resourceId as ResourcesIds;

  const actualBalance = useMemo(() => {
    return resourceManager.balance(resourceId);
  }, [resourceManager, resourceId, currentTick]);

  // Always show actual + produced (was previously only on hover)
  useEffect(() => {
    setDisplayBalance(Number(actualBalance || 0) + Number(amountProduced || 0n));
  }, [actualBalance, amountProduced]);

  useEffect(() => {
    if (currentTick === 0) return;

    const { balance, hasReachedMaxCapacity, amountProduced, amountProducedLimited } =
      resourceManager.balanceWithProduction(currentTick, resourceEnumId);

    setBalance(balance);
    setHasReachedMaxCap(hasReachedMaxCapacity);
    setAmountProduced(amountProduced);
    setAmountProducedLimited(amountProducedLimited);
  }, [resourceManager, resourceEnumId, currentTick]);

  const productionInfo = useMemo(() => {
    const resourceComponent = resourceManager.getResource();
    if (!resourceComponent) return null;

    return ResourceManager.balanceAndProduction(resourceComponent, resourceEnumId);
  }, [resourceManager, resourceEnumId, currentTick]);

  const productionData = useMemo(() => {
    if (!productionInfo) return null;

    return ResourceManager.calculateResourceProductionData(resourceEnumId, productionInfo, currentTick);
  }, [productionInfo, resourceEnumId, currentTick]);

  const productionRate = productionData?.productionPerSecond ?? 0;
  const isProducing = productionData?.isProducing ?? false;

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, resourceId);
  }, [resourceManager, currentTick]);

  // The default tick advances on the one clock; the cap is re-read as it does.
  useEffect(() => {
    if (!isProducing || hasReachedMaxCap) return;
    const { hasReachedMaxCapacity } = resourceManager.balanceWithProduction(currentTick, resourceEnumId);
    setHasReachedMaxCap(hasReachedMaxCapacity);
  }, [resourceManager, resourceEnumId, currentTick, isProducing, hasReachedMaxCap]);

  const icon = useMemo(() => {
    return <ResourceIcon withTooltip={false} resource={ResourcesIds[resourceId]} size="sm" className="self-center" />;
  }, [resourceId, size]);

  const handleMouseLeave = useCallback(() => setTooltip(null), [setTooltip]);

  const mode = useGameModeConfig();

  const canShowProductionShortcut = useMemo(() => {
    if (!canOpenProduction) return false;
    if (!resourceId && resourceId !== 0) return false;
    return mode.resources.canShowProductionShortcut(resourceId as ResourcesIds);
  }, [canOpenProduction, mode.resources, resourceId]);

  const canOpenCraftRelic = useMemo(() => {
    if (resourceEnumId !== ResourcesIds.Research || balance <= 0) {
      return false;
    }

    const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(resourceManager.entityId)]));
    const structureCategory = Number(structure?.base?.category ?? structure?.category ?? 0);

    return structureCategory === StructureType.Realm || structureCategory === StructureType.Village;
  }, [balance, components.Structure, resourceEnumId, resourceManager.entityId]);

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
    return activeRelicEffects.some(
      (relicEffect) => relicEffect.id === resourceId && relicEffect.endTick > currentArmiesTick,
    );
  }, [resourceManager, resourceId, currentArmiesTick]);

  // Calculate time remaining for active relic with real-time countdown
  const relicTimeRemaining = useMemo(() => {
    if (!isRelic || !relicEffectActivated) return 0;

    // Get the relic effect data to access end_tick
    const relicEffect = activeRelicEffects.find((relicEffect) => relicEffect.id === resourceId);
    if (!relicEffect) return 0;

    // Calculate remaining ticks until effect ends
    const remainingTicks = relicsArmiesTicksLeft(relicEffect.endTick, currentArmiesTick);

    // Get tick interval for armies (relics use army ticks)
    const armyTickInterval = configManager.getTick(TickIds.Armies) || 1;

    // Calculate total remaining time: (full remaining ticks * tick duration) + time left in current tick
    // Only add current tick time remaining if there are remaining ticks
    const remainingSeconds = remainingTicks > 0 ? remainingTicks * armyTickInterval + armiesTickTimeRemaining : 0;

    return Math.max(0, remainingSeconds);
  }, [isRelic, relicEffectActivated, resourceManager, resourceId, currentArmiesTick, armiesTickTimeRemaining]);

  // Check if we should hide this resource based on the balance and hideZeroBalance prop
  // Show relics with active effects even if balance is 0
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
        value={displayBalance}
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
          <Sparkles className="h-3 w-3 animate-pulse" />
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
          <Factory className="h-4 w-4" />
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
          <FlaskConical className="h-4 w-4" />
        </button>
      )}
      {showTransfer && (
        <ResourceTransferPopover
          resourceId={resourceId}
          trigger={({ toggle }) => (
            <button
              data-tooltip-anchor
              onClick={(event) => {
                event.stopPropagation();
                toggle();
              }}
              disabled={disableButtons}
              className={actionButton}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
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
          <Sparkles className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
