import { Loader, RefreshCw, Trash2 } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ArmyCapacity } from "@/ui/design-system/molecules/army-capacity";
import { StaminaResource } from "@/ui/design-system/molecules/stamina-resource";
import { TroopChip } from "@/ui/features/military";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import { ArmyWarning } from "../armies/army-warning";
import { ActiveRelicEffects } from "./active-relic-effects";
import { EntityInventoryTabs } from "./entity-inventory-tabs";
import { dangerActionClasses, standardActionClasses } from "./action-button-classes";
import { usePlayerAvatarByUsername } from "@/hooks/use-player-avatar";
import TextInput from "@/ui/design-system/atoms/text-input";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { EXPLORATION_STRATEGIES } from "@/automation/exploration";
import { DEFAULT_SCOPE_RADIUS, DEFAULT_STRATEGY_ID, useExplorationAutomationStore } from "@/hooks/store/use-exploration-automation-store";

import { useArmyEntityDetail } from "./hooks/use-army-entity-detail";

export interface ArmyEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const ArmyEntityDetail = memo(
  ({
    armyEntityId,
    className,
    compact = false,
    maxInventory = Infinity,
    showButtons = false,
  }: ArmyEntityDetailProps) => {
    const {
      explorer,
      explorerResources,
      structure,
      structureResources,
      relicEffects,
      derivedData,
      alignmentBadge,
      isLoadingExplorer,
      isLoadingStructure,
      isRefreshing,
      handleRefresh,
      lastRefresh,
      handleDeleteExplorer,
      isLoadingDelete,
    } = useArmyEntityDetail({ armyEntityId });
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

    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const sectionTitleClass = `${smallTextClass} font-semibold uppercase tracking-[0.2em] text-gold/80`;
    const headerCardClass = cn(
      "relative overflow-hidden rounded-xl border border-gold/25 bg-gradient-to-br from-dark-brown/90 via-brown/75 to-dark/80",
      compact ? "px-3 py-3" : "px-4 py-4",
    );
    const panelClasses = (...extras: Array<string | false | undefined>) =>
      cn("rounded-lg border border-gold/20 bg-dark-brown/70 shadow-md", compact ? "px-3 py-2" : "px-4 py-3", ...extras);
    const sectionsLayoutClass = `flex flex-col ${compact ? "gap-2" : "gap-3"} w-full`;

    return (
      <div className={cn("flex flex-col", compact ? "gap-1" : "gap-3", className)}>
        <div className={headerCardClass}>
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex flex-1 flex-col gap-1">
                <span className={`${smallTextClass} uppercase tracking-[0.22em] text-gold/70`}>Army</span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className={`${compact ? "text-xl" : "text-2xl"} font-bold text-gold`}>
                    {derivedData.addressName}
                  </h4>
                  <span className="text-xxs uppercase tracking-[0.28em] text-gold/60">#{armyEntityId}</span>
                </div>
                <div className="flex items-center gap-2">
                  {ownerAvatarUrl && (
                    <img
                      className="h-8 w-8 rounded-full border border-gold/30 object-cover"
                      src={ownerAvatarUrl}
                      alt={`${derivedData.addressName} avatar`}
                    />
                  )}
                  <div className="flex flex-col gap-0.5">
                    {derivedData.playerGuild && (
                      <div className={`${smallTextClass} text-gold/60`}>Guild · {derivedData.playerGuild.name}</div>
                    )}
                    {derivedData.structureOwnerName && (
                      <div className={`${smallTextClass} text-gold/60`}>
                        Stationed at · {derivedData.structureOwnerName}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {alignmentBadge && (
                  <span
                    className={`rounded-full px-3 py-1 text-xxs font-semibold uppercase tracking-[0.25em] ${alignmentBadge.className}`}
                  >
                    {alignmentBadge.label}
                  </span>
                )}
                {showButtons && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button
                      onClick={handleRefresh}
                      className={standardActionClasses}
                      disabled={isRefreshing || Date.now() - lastRefresh < 10000}
                      title="Refresh data"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                    {derivedData.isMine && (
                      <button
                        onClick={handleDeleteExplorer}
                        className={dangerActionClasses}
                        title="Delete Army"
                        disabled={isLoadingDelete}
                      >
                        {isLoadingDelete ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" />
                            <span>Deleting</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={sectionsLayoutClass}>
          <div className={panelClasses()}>
            <div className={`${sectionTitleClass} mb-2`}>Army Composition</div>
            <TroopChip troops={explorer.troops} size={compact ? "md" : "lg"} />
          </div>

          <div className={panelClasses()}>
            <div className={`${sectionTitleClass} mb-2`}>Vitals</div>
            <div className="flex flex-col gap-2">
              {structureResources && explorerResources && (
                <div className="mb-2">
                  <ArmyWarning
                    army={explorer}
                    explorerResources={explorerResources}
                    structureResources={structureResources}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`${smallTextClass} uppercase text-gold/70`}>Stamina</span>
                {derivedData.stamina && derivedData.maxStamina && (
                  <StaminaResource
                    entityId={armyEntityId}
                    stamina={derivedData.stamina}
                    maxStamina={derivedData.maxStamina}
                    className="flex-1"
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`${smallTextClass} uppercase text-gold/70`}>Capacity</span>
                <ArmyCapacity resource={explorerResources} />
              </div>
            </div>
          </div>

          {showButtons && derivedData.isMine && (
            <ExplorationAutomationSection explorerId={armyEntityId} className={panelClasses()} />
          )}

          {explorerResources ? (
            <div className={panelClasses("flex flex-col")}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <div className="mt-2">
                <EntityInventoryTabs
                  resources={explorerResources}
                  activeRelicIds={relicEffects.map((effect) => effect.id)}
                  entityId={armyEntityId}
                  entityOwnerId={explorer.owner}
                  recipientType={RelicRecipientType.Explorer}
                  maxItems={maxInventory}
                  compact={compact}
                  allowRelicActivation={showButtons && derivedData.isMine}
                  resourceLabel="Resources"
                  relicLabel="Relics"
                />
              </div>
            </div>
          ) : (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-2`}>Inventory</div>
              <p className={`${smallTextClass} text-gold/60 italic`}>No resources stored.</p>
            </div>
          )}

          {relicEffects.length > 0 && (
            <div className={panelClasses()}>
              <div className={`${sectionTitleClass} mb-2`}>Active Relic Effects</div>
              <ActiveRelicEffects relicEffects={relicEffects} entityId={armyEntityId} compact={compact} />
            </div>
          )}
        </div>
      </div>
    );
  },
);

ArmyEntityDetail.displayName = "ArmyEntityDetail";

const ExplorationAutomationSection = ({ explorerId, className }: { explorerId: ID; className?: string }) => {
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

  return (
    <div className={className}>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80 mb-2">Exploration Automation</div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Unit ID</span>
          <TextInput disabled value={String(explorerId)} onChange={() => {}} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Scope Radius</span>
          <NumberInput value={scopeRadius} onChange={setScopeRadius} min={1} className="h-9" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Strategy</span>
          <Select value={strategyId} onValueChange={setStrategyId}>
            <SelectTrigger className="h-9">
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
          {entry && (
            <button type="button" onClick={handleDisable} className={dangerActionClasses} disabled={!entry.active}>
              Disable
            </button>
          )}
          <span className="text-xxs text-gold/60 uppercase tracking-[0.2em]">{statusLabel}</span>
        </div>

        {entry?.blockedReason && (
          <div className="text-xxs text-warning uppercase tracking-[0.2em]">Blocked: {entry.blockedReason}</div>
        )}
      </div>
    </div>
  );
};
