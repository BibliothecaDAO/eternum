import Loader from "lucide-react/dist/esm/icons/loader";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { memo, type ReactNode, useMemo } from "react";

import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { getAvatarUrl } from "@/hooks/use-player-avatar";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import {
  isStaminaRecharging,
  STAMINA_RECHARGING_FILL_CLASS,
  STAMINA_RECHARGING_TEXT_CLASS,
  STAMINA_RECHARGING_TRACK_CLASS,
} from "@/ui/shared/lib/stamina-visuals";
import { resolveStaminaDisplay } from "@/ui/shared/lib/stamina-display";
import { formatNumber } from "@/ui/utils/utils";
import { EntityType, ID, RelicRecipientType } from "@bibliothecadao/types";
import { ActiveRelicEffects } from "../active-relic-effects";
import { useArmyMovementReadiness } from "../../armies/army-movement-readiness";
import { ArmyWarning } from "../../armies/army-warning";
import { formatTravelBlockedSummary, getArmyFoodRequirementLabel } from "../../armies/army-warning-copy";
import { buildDisplayItems, CompactEntityInventory, countDisplayItems } from "../compact-entity-inventory";
import { useArmyEntityDetail } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant } from "../layout";
import { shouldShowArmyResourceInventoryTab } from "./army-banner-tabs";

interface ArmyBannerEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  showButtons?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
  /**
   * Optional "ARMY TILE · (col, row)" band rendered above the avatar row, mirrors
   * the StructureBannerEntityDetail merge so the right-side inspector only has
   * one panel per tile.
   */
  coordsLabel?: string;
  /** Action rendered to the right of {@link coordsLabel} (typically Re-sync). */
  headerAction?: ReactNode;
}

interface ArmyBannerEntityDetailContentProps extends Omit<ArmyBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const ArmyBannerEntityDetailContent = memo(
  ({ armyEntityId, className, compact = true, coordsLabel, headerAction }: ArmyBannerEntityDetailContentProps) => {
    const {
      explorer,
      explorerResources,
      structureResources,
      relicEffects,
      derivedData,
      isLoadingExplorer,
      isLoadingStructure,
      handleDeleteExplorer,
      isLoadingDelete,
    } = useArmyEntityDetail({ armyEntityId });
    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);
    const currentDefaultTick = useCurrentDefaultTick();
    const inventoryItems = useMemo(
      () => buildDisplayItems(explorerResources, currentDefaultTick, activeRelicIds, RelicRecipientType.Explorer),
      [activeRelicIds, currentDefaultTick, explorerResources],
    );
    const inventoryCounts = useMemo(() => countDisplayItems(inventoryItems), [inventoryItems]);
    const resolvedWorldMode = useResolvedWorldGameMode();
    const movementReadiness = useArmyMovementReadiness(explorer, structureResources);
    const ownerUsername = derivedData?.addressName ?? null;
    const ownerAvatarUrl = ownerUsername ? getAvatarUrl(ownerUsername) : null;

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const hasWarnings = Boolean(structureResources && explorerResources);
    const inventoryLimit = compact ? 10 : undefined;
    const combatRelicActionLimit = compact ? 4 : undefined;
    // Show every held relic — activatable ones are clickable, the rest render
    // dimmed/disabled so you can still see what the army carries.
    const showRelicsInline = derivedData.isMine && inventoryCounts.relics > 0;
    const ownerDisplay = derivedData.addressName ?? `Army Owner`;
    const stationedDisplay = derivedData.structureOwnerName ?? "Field deployment";
    const ownerInitial = (ownerDisplay || "?").charAt(0).toUpperCase();
    const headerTitleClass = compact ? "text-sm" : "text-base";
    const headerMetaClass = compact ? "text-xxs" : "text-xs";
    const statusLabel = derivedData.isMine ? "You" : "Other";
    const statusClass = derivedData.isMine
      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
      : "border-red-400/40 bg-red-400/15 text-red-200";
    const currentStamina = derivedData.staminaDisplay?.displayCurrent ?? Number(derivedData.stamina.amount);
    const maxStamina = derivedData.maxStamina;
    const travelBlocked = movementReadiness ? !movementReadiness.canTravel : false;
    const travelBlockedTitle = movementReadiness
      ? formatTravelBlockedSummary({
          staminaBlocked: movementReadiness.hasTravelStaminaWarning,
          minTravelStamina: movementReadiness.minTravelStamina,
          missingWheat: movementReadiness.foodWarnings.travel.missingWheat,
          missingFish: movementReadiness.foodWarnings.travel.missingFish,
          wheatLabel: getArmyFoodRequirementLabel(resolvedWorldMode),
          formatAmount: (amount) => formatNumber(amount, 0),
        })
      : null;
    const showResourceInventoryInline = shouldShowArmyResourceInventoryTab(
      resolvedWorldMode,
      inventoryCounts.resources,
    );

    return (
      <div
        className={cn(
          "pointer-events-auto flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-xl px-3 py-3",
          OVERLAY_SURFACE_BASE,
          hasWarnings && "ring-1 ring-gold/30",
          className,
        )}
      >
        {coordsLabel && (
          <div className="flex items-center justify-between gap-2 border-b border-gold/15 pb-2">
            <span className={cn("min-w-0 flex-1 truncate", HUD_LABEL)}>{coordsLabel}</span>
            {headerAction}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gold/30 bg-black/40">
              {ownerAvatarUrl ? (
                <img className="h-full w-full object-cover" src={ownerAvatarUrl} alt={`${ownerDisplay} avatar`} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gold/70">
                  {ownerInitial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn("truncate font-semibold text-gold", headerTitleClass)}>{ownerDisplay}</p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                    statusClass,
                  )}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className={cn("truncate text-gold/80", headerMetaClass)}>{stationedDisplay}</span>
              </div>
            </div>
          </div>
          {derivedData.isMine ? (
            <button
              type="button"
              onClick={handleDeleteExplorer}
              disabled={isLoadingDelete}
              className="inline-flex items-center rounded border border-red-500/40 p-1 text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              title={isLoadingDelete ? "Deleting" : "Delete Army"}
            >
              {isLoadingDelete ? <Loader className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span className="sr-only">Delete Army</span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <TroopChip troops={explorer.troops} size="sm" className="w-full" />
          {derivedData.stamina && derivedData.maxStamina ? (
            <InlineStaminaBar
              currentStamina={currentStamina}
              maxStamina={maxStamina}
              isRecharging={derivedData.staminaDisplay?.isRecharging}
              travelBlocked={travelBlocked}
              travelBlockedTitle={travelBlockedTitle}
              rightAccessory={hasWarnings && movementReadiness ? <ArmyWarning readiness={movementReadiness} /> : null}
            />
          ) : null}
          {showRelicsInline && (
            <CompactEntityInventory
              resources={explorerResources}
              activeRelicIds={activeRelicIds}
              recipientType={RelicRecipientType.Explorer}
              entityId={armyEntityId}
              entityType={EntityType.ARMY}
              allowRelicActivation
              variant="tight"
              maxItems={combatRelicActionLimit}
              filter="relics"
              showHiddenCount={false}
              emptyMessage="No relics ready."
            />
          )}
          {relicEffects.length > 0 && (
            <ActiveRelicEffects relicEffects={relicEffects} entityId={armyEntityId} compact />
          )}
          {showResourceInventoryInline && (
            <CompactEntityInventory
              resources={explorerResources}
              activeRelicIds={activeRelicIds}
              recipientType={RelicRecipientType.Explorer}
              entityId={armyEntityId}
              entityType={EntityType.ARMY}
              variant="tight"
              maxItems={inventoryLimit}
              filter="resources"
              emptyMessage="No resources carried."
              showHiddenCount={false}
            />
          )}
        </div>

        {/* {derivedData.isMine ? (
          <ExplorationAutomationCompact explorerId={explorer.explorer_id ?? armyEntityId} compact={compact} />
        ) : null} */}
      </div>
    );
  },
);
ArmyBannerEntityDetailContent.displayName = "ArmyBannerEntityDetailContent";

export const ArmyBannerEntityDetail = memo(
  ({
    armyEntityId,
    className,
    compact = true,
    showButtons = false,
    layoutVariant,
    coordsLabel,
    headerAction,
  }: ArmyBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <ArmyBannerEntityDetailContent
        armyEntityId={armyEntityId}
        className={className}
        compact={compact}
        showButtons={showButtons}
        variant={resolvedVariant}
        coordsLabel={coordsLabel}
        headerAction={headerAction}
      />
    );
  },
);

ArmyBannerEntityDetail.displayName = "ArmyBannerEntityDetail";

const InlineStaminaBar = ({
  currentStamina,
  maxStamina,
  isRecharging,
  travelBlocked,
  travelBlockedTitle,
  rightAccessory,
}: {
  currentStamina: number;
  maxStamina: number;
  isRecharging?: boolean | null;
  travelBlocked?: boolean;
  travelBlockedTitle?: string | null;
  rightAccessory?: ReactNode;
}) => {
  if (maxStamina === 0) return null;
  const { committedPercentage, displayPercentage, displayedCurrent } = resolveStaminaDisplay({
    current: currentStamina,
    max: maxStamina,
  });
  const recharging = isRecharging ?? isStaminaRecharging(displayedCurrent, maxStamina);

  // Red exclusively means "this army cannot take its cheapest move right now"
  // (stamina- or food-blocked); low-but-movable stamina renders amber so the
  // blocked signal stays unambiguous. The readiness icons say why.
  const fillClass = travelBlocked
    ? "bg-progress-bar-danger"
    : displayPercentage > 66
      ? "bg-progress-bar-good"
      : "bg-progress-bar-medium";

  return (
    <div
      className="flex items-center gap-2 text-xxs text-gold/80"
      title={travelBlocked ? (travelBlockedTitle ?? undefined) : undefined}
    >
      <Lightning className={cn("h-3 w-3 fill-order-power", recharging && STAMINA_RECHARGING_TEXT_CLASS)} />
      <div
        className={cn(
          "flex-1 h-2 rounded-full border border-gray-600 overflow-hidden",
          recharging && STAMINA_RECHARGING_TRACK_CLASS,
        )}
      >
        <div
          className={cn(fillClass, "h-full rounded-full opacity-45 transition-all duration-300")}
          style={{ width: `${committedPercentage}%` }}
        />
        <div
          className={cn(
            fillClass,
            "h-full rounded-full transition-all duration-1000 -mt-2",
            recharging && STAMINA_RECHARGING_FILL_CLASS,
          )}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
      <span className={cn("whitespace-nowrap", recharging && STAMINA_RECHARGING_TEXT_CLASS)}>
        {`${displayedCurrent}/${maxStamina}`}
      </span>
      {rightAccessory ? <div className="flex shrink-0 items-center">{rightAccessory}</div> : null}
    </div>
  );
};
