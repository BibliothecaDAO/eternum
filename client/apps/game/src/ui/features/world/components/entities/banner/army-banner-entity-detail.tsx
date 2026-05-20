import Package from "lucide-react/dist/esm/icons/package";
import Loader from "lucide-react/dist/esm/icons/loader";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Swords from "lucide-react/dist/esm/icons/swords";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { memo, type ReactNode, useMemo } from "react";

import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { usePlayerAvatarByUsername } from "@/hooks/use-player-avatar";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import {
  isStaminaRecharging,
  STAMINA_RECHARGING_FILL_CLASS,
  STAMINA_RECHARGING_TEXT_CLASS,
  STAMINA_RECHARGING_TRACK_CLASS,
} from "@/ui/shared/lib/stamina-visuals";
import { resolveStaminaDisplay } from "@/ui/shared/lib/stamina-display";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, EntityType, ID, RelicRecipientType, TroopType } from "@bibliothecadao/types";
import { ActiveRelicEffects } from "../active-relic-effects";
import { ArmyWarning } from "../../armies/army-warning";
import { buildDisplayItems, CompactEntityInventory, countDisplayItems } from "../compact-entity-inventory";
import { useArmyEntityDetail } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";
import { EntityBannerTabCue, resolveEntityBannerRelicCue } from "./entity-banner-tab-cue";
import {
  ARMY_RESOURCE_INVENTORY_TAB_LABEL,
  formatArmyCombatTabCue,
  formatArmyTroopCountLabel,
  shouldShowArmyResourceInventoryTab,
} from "./army-banner-tabs";

interface ArmyBannerEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  showButtons?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface ArmyBannerEntityDetailContentProps extends Omit<ArmyBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const ArmyBannerEntityDetailContent = memo(
  ({ armyEntityId, className, compact = true }: ArmyBannerEntityDetailContentProps) => {
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
    const ownerUsername = derivedData?.addressName ?? null;
    const { data: ownerProfileByUsername } = usePlayerAvatarByUsername(ownerUsername);
    const ownerAvatarUrl = ownerProfileByUsername?.avatarUrl ?? null;

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const hasWarnings = Boolean(structureResources && explorerResources);
    const visibleRelicEffects = compact ? relicEffects.slice(0, 2) : relicEffects;
    const hiddenRelicEffects = Math.max(relicEffects.length - visibleRelicEffects.length, 0);
    const inventoryLimit = compact ? 10 : undefined;
    const ownerDisplay = derivedData.addressName ?? `Army Owner`;
    const stationedDisplay = derivedData.structureOwnerName ?? "Field deployment";
    const ownerInitial = (ownerDisplay || "?").charAt(0).toUpperCase();
    const headerTitleClass = compact ? "text-sm" : "text-base";
    const headerMetaClass = compact ? "text-xxs" : "text-xs";
    const statusLabel = derivedData.isMine ? "You" : "Other";
    const statusClass = derivedData.isMine
      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
      : "border-red-400/40 bg-red-400/15 text-red-200";
    const troopCount = explorer.troops.count;
    const troopCountLabel = formatArmyTroopCountLabel(troopCount);
    const combatTabCue = formatArmyCombatTabCue(troopCount);
    const currentStamina = derivedData.staminaDisplay?.displayCurrent ?? Number(derivedData.stamina.amount);
    const maxStamina = derivedData.maxStamina;
    const minTravelCost = configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman);
    const combatCueTone =
      maxStamina === 0
        ? "muted"
        : currentStamina < minTravelCost
          ? "danger"
          : currentStamina < maxStamina
            ? "warning"
            : "success";
    const showResourceInventoryTab = shouldShowArmyResourceInventoryTab(resolvedWorldMode, inventoryCounts.resources);
    const resourceInventoryCueTone = inventoryCounts.resources > 0 ? "default" : "muted";
    const totalRelicCount = inventoryCounts.totalRelics;
    const usableRelicCount = derivedData.isMine ? inventoryCounts.usableRelics : 0;
    const relicCue = resolveEntityBannerRelicCue(usableRelicCount, totalRelicCount);
    const relicTabLabel = relicCue.state === "empty" ? "Relics 0" : `Relics ${usableRelicCount}/${totalRelicCount}`;
    const showCombatRelicActions = derivedData.isMine && usableRelicCount > 0;
    const combatRelicActionLimit = compact ? 4 : undefined;

    return (
      <EntityDetailSection
        compact={compact}
        tone={hasWarnings ? "highlight" : "default"}
        className={cn("flex h-full min-h-0 flex-col gap-2 overflow-hidden", className)}
      >
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

        <Tabs variant="entityBanner" className="flex min-h-0 flex-1 flex-col gap-2">
          <Tabs.Panels className="flex-1 min-h-0">
            <Tabs.Panel scrollable={false} className="flex h-full min-h-0 flex-col gap-2">
              <TroopChip troops={explorer.troops} size="sm" className="w-full" />
              {derivedData.stamina && derivedData.maxStamina ? (
                <InlineStaminaBar
                  currentStamina={currentStamina}
                  maxStamina={maxStamina}
                  isRecharging={derivedData.staminaDisplay?.isRecharging}
                  rightAccessory={
                    hasWarnings && explorerResources && structureResources ? (
                      <ArmyWarning
                        army={explorer}
                        explorerResources={explorerResources}
                        structureResources={structureResources}
                      />
                    ) : null
                  }
                />
              ) : null}
              {showCombatRelicActions ? (
                <CompactEntityInventory
                  resources={explorerResources}
                  activeRelicIds={activeRelicIds}
                  recipientType={RelicRecipientType.Explorer}
                  entityId={armyEntityId}
                  entityType={EntityType.ARMY}
                  allowRelicActivation
                  variant="tight"
                  maxItems={combatRelicActionLimit}
                  filter="usableRelics"
                  showHiddenCount={false}
                  emptyMessage="No relics ready."
                  className="min-h-0"
                />
              ) : null}
              {visibleRelicEffects.length > 0 ? (
                <ActiveRelicEffects
                  relicEffects={relicEffects}
                  entityId={armyEntityId}
                  variant="inline"
                  maxItems={compact ? 2 : undefined}
                  className="min-h-0"
                />
              ) : null}
            </Tabs.Panel>

            {showResourceInventoryTab && (
              <Tabs.Panel scrollable={false} className="flex h-full min-h-0 flex-col gap-2">
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
                />
              </Tabs.Panel>
            )}

            <Tabs.Panel scrollable={false} className="flex h-full min-h-0 flex-col gap-2">
              {visibleRelicEffects.length > 0 && (
                <ActiveRelicEffects relicEffects={visibleRelicEffects} entityId={armyEntityId} compact />
              )}
              {hiddenRelicEffects > 0 && (
                <p className="text-xxs text-gold/60 italic">+{hiddenRelicEffects} more relic effect(s) active</p>
              )}
              <CompactEntityInventory
                resources={explorerResources}
                activeRelicIds={activeRelicIds}
                recipientType={RelicRecipientType.Explorer}
                entityId={armyEntityId}
                entityType={EntityType.ARMY}
                allowRelicActivation={derivedData.isMine}
                variant="tight"
                maxItems={inventoryLimit}
                filter="relics"
                emptyMessage="No relics attached."
              />
            </Tabs.Panel>
          </Tabs.Panels>

          <Tabs.List>
            <Tabs.Tab aria-label={`Combat ${troopCountLabel}`} title={`Combat ${troopCountLabel}`}>
              <EntityBannerTabCue icon={Swords} label="Combat" cue={combatTabCue} tone={combatCueTone} />
            </Tabs.Tab>
            {showResourceInventoryTab && (
              <Tabs.Tab
                aria-label={`${ARMY_RESOURCE_INVENTORY_TAB_LABEL} ${inventoryCounts.resources}`}
                title={`${ARMY_RESOURCE_INVENTORY_TAB_LABEL} ${inventoryCounts.resources}`}
              >
                <EntityBannerTabCue
                  icon={Package}
                  label={ARMY_RESOURCE_INVENTORY_TAB_LABEL}
                  cue={inventoryCounts.resources}
                  tone={resourceInventoryCueTone}
                />
              </Tabs.Tab>
            )}
            <Tabs.Tab aria-label={relicTabLabel} title={relicTabLabel} disabled={relicCue.disabled}>
              <EntityBannerTabCue icon={Sparkles} label="Relics" splitCue={relicCue.splitCue} />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* {derivedData.isMine ? (
          <ExplorationAutomationCompact explorerId={explorer.explorer_id ?? armyEntityId} compact={compact} />
        ) : null} */}
      </EntityDetailSection>
    );
  },
);
ArmyBannerEntityDetailContent.displayName = "ArmyBannerEntityDetailContent";

export const ArmyBannerEntityDetail = memo(
  ({ armyEntityId, className, compact = true, showButtons = false, layoutVariant }: ArmyBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <ArmyBannerEntityDetailContent
        armyEntityId={armyEntityId}
        className={className}
        compact={compact}
        showButtons={showButtons}
        variant={resolvedVariant}
      />
    );
  },
);

ArmyBannerEntityDetail.displayName = "ArmyBannerEntityDetail";

const InlineStaminaBar = ({
  currentStamina,
  maxStamina,
  isRecharging,
  rightAccessory,
}: {
  currentStamina: number;
  maxStamina: number;
  isRecharging?: boolean | null;
  rightAccessory?: ReactNode;
}) => {
  if (maxStamina === 0) return null;
  const { committedPercentage, displayPercentage, displayedCurrent } = resolveStaminaDisplay({
    current: currentStamina,
    max: maxStamina,
  });
  const minTravelCost = configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman);
  const recharging = isRecharging ?? isStaminaRecharging(displayedCurrent, maxStamina);

  let fillClass = "bg-progress-bar-danger";
  if (displayedCurrent >= minTravelCost) {
    fillClass =
      displayPercentage > 66
        ? "bg-progress-bar-good"
        : displayPercentage > 33
          ? "bg-progress-bar-medium"
          : "bg-progress-bar-danger";
  }

  return (
    <div className="flex items-center gap-2 text-xxs text-gold/80">
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
