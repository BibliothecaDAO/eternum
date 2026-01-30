import Bot from "lucide-react/dist/esm/icons/bot";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Loader from "lucide-react/dist/esm/icons/loader";
import Settings from "lucide-react/dist/esm/icons/settings";
import Square from "lucide-react/dist/esm/icons/square";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { memo, useEffect, useMemo, useState } from "react";

import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { usePlayerAvatarByUsername } from "@/hooks/use-player-avatar";
import {
  DEFAULT_SCOPE_RADIUS,
  DEFAULT_STRATEGY_ID,
  useExplorationAutomationStore,
} from "@/hooks/store/use-exploration-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { explorationAutomation } from "@/ui/features/world";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { EXPLORATION_STRATEGIES } from "@/automation/exploration";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, EntityType, ID, RelicRecipientType, TroopType } from "@bibliothecadao/types";
import { ActiveRelicEffects } from "../active-relic-effects";
import { ArmyWarning } from "../../armies/army-warning";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useArmyEntityDetail } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";

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

        {relicEffects.length > 0 && (
          <ActiveRelicEffects relicEffects={relicEffects} entityId={armyEntityId} compact />
        )}

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

        {derivedData.isMine ? (
          <ExplorationAutomationCompact explorerId={explorer.explorer_id ?? armyEntityId} compact={compact} />
        ) : null}
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

const ExplorationAutomationCompact = ({ explorerId, compact: _compact }: { explorerId: ID; compact: boolean }) => {
  const entries = useExplorationAutomationStore((s) => s.entries);
  const addEntry = useExplorationAutomationStore((s) => s.add);
  const updateEntry = useExplorationAutomationStore((s) => s.update);
  const toggleActive = useExplorationAutomationStore((s) => s.toggleActive);
  const togglePopup = useUIStore((state) => state.togglePopup);

  const handleOpenDashboard = () => {
    togglePopup(explorationAutomation);
  };

  const entry = useMemo(
    () => Object.values(entries).find((item) => item.explorerId === String(explorerId)),
    [entries, explorerId],
  );

  const [showSettings, setShowSettings] = useState(false);
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

  const handleQuickEnable = () => {
    if (!entry) {
      addEntry({
        explorerId: String(explorerId),
        scopeRadius: DEFAULT_SCOPE_RADIUS,
        strategyId: DEFAULT_STRATEGY_ID,
        active: true,
      });
    } else if (!entry.active) {
      toggleActive(entry.id, true);
    }
  };

  const handleSaveSettings = () => {
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
    setShowSettings(false);
  };

  const handleStop = () => {
    if (!entry) return;
    toggleActive(entry.id, false);
  };

  const isActive = entry?.active ?? false;
  const isBlocked = Boolean(entry?.blockedReason);
  const lastAction = entry?.lastAction;

  // Time formatting
  const formatRelativeTime = (timestamp?: number | null) => {
    if (!timestamp) return "never";
    const now = Date.now();
    const diff = timestamp - now;
    const absDiff = Math.abs(diff);

    if (absDiff < 1000) return "now";

    const seconds = Math.floor(absDiff / 1000);
    if (seconds < 60) {
      return diff > 0 ? `in ${seconds}s` : `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return diff > 0 ? `in ${minutes}m` : `${minutes}m ago`;
    }

    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Status indicator styles
  const getStatusColor = () => {
    if (!entry) return "bg-gold/20 border-gold/30";
    if (!isActive) return "bg-gold/10 border-gold/20";
    if (isBlocked) return "bg-amber-500/20 border-amber-500/40";
    return "bg-emerald-500/20 border-emerald-500/40";
  };

  const getStatusDot = () => {
    if (!entry || !isActive) return null;
    if (isBlocked) return "bg-amber-400";
    return "bg-emerald-400 animate-pulse";
  };

  // Inactive state - show simple enable button
  if (!entry || !isActive) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickEnable}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              "border-gold/30 bg-gold/5 text-gold/80 hover:bg-gold/15 hover:border-gold/50 hover:text-gold",
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Enable Auto-Explore</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "flex items-center justify-center rounded-lg border p-2 transition-all",
              "border-gold/20 bg-black/20 text-gold/50 hover:bg-gold/10 hover:text-gold/80",
            )}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleOpenDashboard}
            className={cn(
              "flex items-center justify-center rounded-lg border p-2 transition-all",
              "border-gold/20 bg-black/20 text-gold/50 hover:bg-gold/10 hover:text-gold/80",
            )}
            title="All Automations"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Expandable settings */}
        {showSettings && (
          <div className="flex flex-col gap-2 rounded-lg border border-gold/10 bg-black/40 p-2 animate-in slide-in-from-top-2 duration-200">
            <SettingsPanel
              scopeRadius={scopeRadius}
              setScopeRadius={setScopeRadius}
              strategyId={strategyId}
              setStrategyId={setStrategyId}
            />
            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full rounded border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold/90 transition hover:bg-gold/20"
            >
              Save & Enable
            </button>
          </div>
        )}
      </div>
    );
  }

  // Active state - show compact status with controls
  return (
    <div className="flex flex-col gap-1.5">
      {/* Main status row */}
      <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 transition-all", getStatusColor())}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <Bot className="h-4 w-4 text-gold/70" />
            {getStatusDot() && (
              <span className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full", getStatusDot())} />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-gold/90 truncate">
              {isBlocked ? `Blocked: ${entry.blockedReason}` : "Auto-Exploring"}
            </span>
            {lastAction && !isBlocked && <span className="text-[10px] text-gold/50 truncate">Last: {lastAction}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleOpenDashboard}
            className="flex items-center justify-center rounded p-1.5 text-gold/40 transition-all hover:bg-gold/10 hover:text-gold/70"
            title="All Automations"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "flex items-center justify-center rounded p-1.5 transition-all",
              showSettings ? "bg-gold/20 text-gold" : "text-gold/40 hover:bg-gold/10 hover:text-gold/70",
            )}
            title="Settings"
          >
            {showSettings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleStop}
            className="flex items-center justify-center rounded p-1.5 text-red-400/70 transition-all hover:bg-red-500/10 hover:text-red-400"
            title="Stop"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        </div>
      </div>

      {/* Timing info row */}
      <div className="flex items-center justify-between px-1 text-[10px] text-gold/40">
        <span>Ran: {formatRelativeTime(entry.lastRunAt)}</span>
        <span>Next: {formatRelativeTime(entry.nextRunAt)}</span>
      </div>

      {/* Expandable settings */}
      {showSettings && (
        <div className="flex flex-col gap-2 rounded-lg border border-gold/10 bg-black/40 p-2 animate-in slide-in-from-top-2 duration-200">
          <SettingsPanel
            scopeRadius={scopeRadius}
            setScopeRadius={setScopeRadius}
            strategyId={strategyId}
            setStrategyId={setStrategyId}
          />
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={!hasChanges}
            className={cn(
              "w-full rounded border px-3 py-1.5 text-xs font-medium transition",
              hasChanges
                ? "border-gold/30 bg-gold/10 text-gold/90 hover:bg-gold/20"
                : "border-gold/10 bg-black/20 text-gold/30 cursor-not-allowed",
            )}
          >
            {hasChanges ? "Save Changes" : "No Changes"}
          </button>
        </div>
      )}
    </div>
  );
};

const SettingsPanel = ({
  scopeRadius,
  setScopeRadius,
  strategyId,
  setStrategyId,
}: {
  scopeRadius: number;
  setScopeRadius: (v: number) => void;
  strategyId: string;
  setStrategyId: (v: string) => void;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-gold/40 w-16">Radius</span>
      <NumberInput value={scopeRadius} onChange={setScopeRadius} min={1} className="h-7 text-xs flex-1" />
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-gold/40 w-16">Strategy</span>
      <Select value={strategyId} onValueChange={setStrategyId}>
        <SelectTrigger className="h-7 text-xs flex-1">
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
  </div>
);

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
