import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { configManager } from "@bibliothecadao/eternum";
import { memo, type ReactNode, useMemo } from "react";

import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudChip, HudIconButton, HudMeter, HudPanel, HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { isStaminaRecharging } from "@/ui/shared/lib/stamina-visuals";
import { resolveStaminaDisplay } from "@/ui/shared/lib/stamina-display";
import { formatNumber } from "@/ui/utils/utils";
import { EntityType, ID, RelicRecipientType } from "@bibliothecadao/types";
import { ActiveRelicEffects } from "../active-relic-effects";
import { useArmyMovementReadiness } from "../../armies/army-movement-readiness";
import { ArmyWarning } from "../../armies/army-warning";
import {
  formatFoodBlock,
  formatTravelBlockedSummary,
  getArmyFoodRequirementLabel,
} from "../../armies/army-warning-copy";
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
      structure: ownerStructure,
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
    const ownerAvatarUrl = ownerStructure?.owner ? playerAvatarUrl(ownerStructure.owner) : null;

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <SemanticIcon name="refresh" className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const hasWarnings = Boolean(structureResources && explorerResources);
    const inventoryLimit = compact ? 10 : undefined;
    const combatRelicActionLimit = compact ? 4 : undefined;
    // Show every held relic — activatable ones are clickable, the rest render
    // dimmed/disabled so you can still see what the army carries.
    // Relics are only worth listing where the game lets an army apply them.
    const showRelicsInline =
      derivedData.isMine && inventoryCounts.relics > 0 && configManager.isCommandEnabled("ApplyRelic");
    const ownerDisplay = derivedData.addressName;
    const stationedDisplay = derivedData.structureOwnerName ?? "Field deployment";
    const ownerInitial = (ownerDisplay || "?").charAt(0).toUpperCase();
    const currentStamina = derivedData.staminaDisplay?.committedCurrent ?? Number(derivedData.stamina.amount);
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
      <HudPanel
        title={coordsLabel}
        cue={headerAction}
        className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}
        bodyClassName="flex min-h-0 flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {ownerAvatarUrl ? (
              <HudPortrait src={ownerAvatarUrl} label={`${ownerDisplay} avatar`} />
            ) : (
              <HudPortrait initial={ownerInitial} label={ownerDisplay ?? "Unknown"} />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-hud-strong text-hud-ink">{ownerDisplay}</p>
                <HudChip tone={derivedData.isMine ? "good" : "bad"}>{derivedData.isMine ? "You" : "Other"}</HudChip>
              </div>
              <span className="block truncate text-hud-label text-hud-muted">{stationedDisplay}</span>
            </div>
          </div>
          {derivedData.isMine ? (
            <HudIconButton
              icon={isLoadingDelete ? "refresh" : "trash"}
              label={isLoadingDelete ? "Deleting" : "Delete Army"}
              kind="quiet"
              size="sm"
              tone="bad"
              onClick={handleDeleteExplorer}
              disabled={isLoadingDelete}
            />
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
          {movementReadiness?.foodBlock ? (
            <p className="text-hud-label leading-snug text-hud-warn" role="status">
              {formatFoodBlock(movementReadiness.foodBlock, (amount) => formatNumber(amount, 0))}
            </p>
          ) : null}
          {derivedData.staminaDisplay?.isRecharging && derivedData.staminaDisplay ? (
            <p className="text-hud-label text-hud-muted">
              Rested in {formatRestTime(derivedData.staminaDisplay.secondsUntilFull)}
            </p>
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
      </HudPanel>
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

const formatRestTime = (seconds: number): string => {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

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
  const { committedPercentage, displayedCurrent } = resolveStaminaDisplay({
    current: currentStamina,
    max: maxStamina,
  });
  const recharging = isRecharging ?? isStaminaRecharging(displayedCurrent, maxStamina);

  // Bad exclusively means "this army cannot take its cheapest move right now" (stamina- or food-blocked); low but
  // movable stamina is the warning tone, so the blocked signal stays unambiguous. The readiness icons say why.
  const tone = travelBlocked ? "bad" : committedPercentage > 66 ? "good" : "warn";

  return (
    <div
      className="flex items-center gap-2 text-hud-label text-hud-ink"
      title={travelBlocked ? (travelBlockedTitle ?? undefined) : undefined}
    >
      <SemanticIcon name="stamina" className="h-3 w-3" />
      <span className="min-w-0 flex-1">
        <HudMeter share={committedPercentage / 100} tone={tone} label="Stamina" filling={recharging} />
      </span>
      <span className="whitespace-nowrap tabular-nums">{`${displayedCurrent}/${maxStamina}`}</span>
      {rightAccessory ? <div className="flex shrink-0 items-center">{rightAccessory}</div> : null}
    </div>
  );
};
