import { Loader, Trash2 } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { usePlayerAvatarByUsername } from "@/hooks/use-player-avatar";
import { DEFAULT_SCOPE_RADIUS, DEFAULT_STRATEGY_ID, useExplorationAutomationStore } from "@/hooks/store/use-exploration-automation-store";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { EXPLORATION_STRATEGIES } from "@/automation/exploration";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, EntityType, ID, RelicRecipientType, TroopType } from "@bibliothecadao/types";
import { ArmyWarning } from "../../armies/army-warning";
import { dangerActionClasses, standardActionClasses } from "../action-button-classes";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useArmyEntityDetail } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";

export interface ArmyBannerEntityDetailProps {
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
  ({
    armyEntityId,
    className,
    compact = true,
    showButtons: _showButtons = false,
    variant: _variant,
  }: ArmyBannerEntityDetailContentProps) => {
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
    const ownerDisplay = derivedData.addressName ?? `Army Owner`;
    const stationedDisplay = derivedData.structureOwnerName ?? "Field deployment";
    const ownerInitial = (ownerDisplay || "?").charAt(0).toUpperCase();
    const headerTitleClass = compact ? "text-sm" : "text-base";
    const headerMetaClass = compact ? "text-xxs" : "text-xs";
    const statusLabel = derivedData.isMine ? "You" : "Other";
    const statusClass = derivedData.isMine
      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
      : "border-red-400/40 bg-red-400/15 text-red-200";

    return (
      <EntityDetailSection
        compact={compact}
        tone={hasWarnings ? "highlight" : "default"}
        className={cn("flex flex-col gap-3", className)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gold/30 bg-black/40">
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
            <InlineStaminaBar stamina={derivedData.stamina} maxStamina={derivedData.maxStamina} />
          ) : null}
        </div>

        {hasWarnings && explorerResources && structureResources ? (
          <ArmyWarning army={explorer} explorerResources={explorerResources} structureResources={structureResources} />
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Relics</span>
          {explorerResources ? (
            <CompactEntityInventory
              resources={explorerResources}
              activeRelicIds={activeRelicIds}
              recipientType={RelicRecipientType.Explorer}
              entityId={armyEntityId}
              entityType={EntityType.ARMY}
              allowRelicActivation={derivedData.isMine}
              variant="tight"
            />
          ) : (
            <p className="text-xxs text-gold/60 italic">No relics attached.</p>
          )}
        </div>

        {derivedData.isMine ? <ExplorationAutomationCompact explorerId={armyEntityId} compact={compact} /> : null}
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

const ExplorationAutomationCompact = ({
  explorerId,
  compact,
}: {
  explorerId: ID;
  compact: boolean;
}) => {
  const entries = useExplorationAutomationStore((s) => s.entries);
  const addEntry = useExplorationAutomationStore((s) => s.add);
  const updateEntry = useExplorationAutomationStore((s) => s.update);
  const toggleActive = useExplorationAutomationStore((s) => s.toggleActive);

  const entry = useMemo(
    () => Object.values(entries).find((item) => item.explorerId === String(explorerId)),
    [entries, explorerId],
  );

  const [scopeRadius, setScopeRadius] = useState<number>(entry?.scopeRadius ?? DEFAULT_SCOPE_RADIUS);
  const [strategyId, setStrategyId] = useState<string>(entry?.strategyId ?? DEFAULT_STRATEGY_ID);

  useEffect(() => {
    setScopeRadius(entry?.scopeRadius ?? DEFAULT_SCOPE_RADIUS);
    setStrategyId(entry?.strategyId ?? DEFAULT_STRATEGY_ID);
  }, [entry?.scopeRadius, entry?.strategyId]);

  const hasChanges = Boolean(
    entry &&
      (entry.scopeRadius !== scopeRadius ||
        entry.strategyId !== (strategyId as typeof entry.strategyId) ||
        entry.blockedReason),
  );

  const handleEnable = () => {
    if (entry) {
      updateEntry(entry.id, { scopeRadius, strategyId: strategyId as typeof entry.strategyId, blockedReason: null });
      if (!entry.active) {
        toggleActive(entry.id, true);
      }
    } else {
      addEntry({
        explorerId: String(explorerId),
        scopeRadius,
        strategyId: strategyId as typeof DEFAULT_STRATEGY_ID,
        active: true,
      });
    }
  };

  const handleDisable = () => {
    if (!entry) return;
    toggleActive(entry.id, false);
  };

  const statusLabel = entry ? (entry.active ? "Active" : "Paused") : "Not configured";
  const inputClass = compact ? "h-8 text-sm" : "h-9";
  const labelClass = compact ? "text-xxs" : "text-xs";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gold/20 bg-black/30 p-2">
      <div className={`${labelClass} uppercase tracking-[0.25em] text-gold/60`}>Exploration Automation</div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.25em] text-gold/50">Scope Radius</span>
          <NumberInput value={scopeRadius} onChange={setScopeRadius} min={1} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.25em] text-gold/50">Strategy</span>
          <Select value={strategyId} onValueChange={setStrategyId}>
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              {EXPLORATION_STRATEGIES.map((strategy) => (
                <SelectItem key={strategy.id} value={strategy.id}>
                  {strategy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            className={standardActionClasses}
            disabled={entry?.active && !hasChanges}
          >
            {entry?.active ? "Update" : "Enable"}
          </button>
          {entry ? (
            <button type="button" onClick={handleDisable} className={dangerActionClasses} disabled={!entry.active}>
              Disable
            </button>
          ) : null}
          <span className="text-xxs text-gold/60 uppercase tracking-[0.25em]">{statusLabel}</span>
        </div>
        {entry?.blockedReason ? (
          <div className="text-xxs text-warning uppercase tracking-[0.25em]">Blocked: {entry.blockedReason}</div>
        ) : null}
      </div>
    </div>
  );
};

const InlineStaminaBar = ({
  stamina,
  maxStamina,
}: {
  stamina: { amount: bigint; updated_tick: bigint };
  maxStamina: number;
}) => {
  if (!stamina || maxStamina === 0) return null;
  const staminaValue = Number(stamina.amount);
  const percentage = (staminaValue / maxStamina) * 100;
  const minTravelCost = configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman);

  let fillClass = "bg-progress-bar-danger";
  if (staminaValue >= minTravelCost) {
    fillClass =
      percentage > 66 ? "bg-progress-bar-good" : percentage > 33 ? "bg-progress-bar-medium" : "bg-progress-bar-danger";
  }

  return (
    <div className="flex items-center gap-2 text-xxs text-gold/80">
      <Lightning className="h-3 w-3 fill-order-power" />
      <div className="flex-1 h-2 rounded-full border border-gray-600 overflow-hidden">
        <div
          className={`${fillClass} h-full rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
      <span className="whitespace-nowrap">{`${staminaValue}/${maxStamina}`}</span>
    </div>
  );
};
