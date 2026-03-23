import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OSWindow, productionAutomation } from "@/ui/features/world";
import { REALM_PRESETS } from "@/utils/automation-presets";
import {
  getFailureSeverity,
  getRealmStatusBorder,
  getRealmStatusColor,
  getRealmStatusLabel,
  timeAgo,
} from "@/utils/automation-status";
import { PROCESS_INTERVAL_MS } from "@/ui/features/infrastructure/automation/model/automation-processor";
import { Bot } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

const getPresetLabel = (presetId: string): string => {
  const preset = REALM_PRESETS.find((p) => p.id === presetId);
  return preset?.label ?? "Custom";
};

const getPresetPillClass = (presetId: string): string => {
  switch (presetId) {
    case "smart":
      return "bg-emerald-500/20 text-emerald-400";
    case "idle":
      return "bg-gold/10 text-gold/50";
    case "custom":
      return "bg-blue-500/20 text-blue-400";
    default:
      return "bg-gold/10 text-gold/50";
  }
};

const getStatusDotBg = (statusStr?: string): string => {
  switch (statusStr) {
    case "success":
      return "bg-emerald-400";
    case "failed":
      return "bg-red-400";
    case "skipped":
      return "bg-amber-400";
    default:
      return "bg-gold/50";
  }
};

interface ProductionAutomationContentProps {
  compact?: boolean;
}

const ProductionAutomationContent = ({ compact = false }: ProductionAutomationContentProps) => {
  const realms = useAutomationStore(useShallow((state) => state.realms));
  const nextRunTimestamp = useAutomationStore((state) => state.nextRunTimestamp);

  const list = useMemo(
    () => Object.values(realms).toSorted((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [realms],
  );

  // Force re-render for relative times and progress bar
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { activeCount, failedCount, skippedCount } = useMemo(() => ({
    activeCount: list.filter((r) => r.presetId !== "idle" && r.lastStatus?.status === "success").length,
    failedCount: list.filter((r) => r.lastStatus?.status === "failed").length,
    skippedCount: list.filter((r) => r.presetId === "idle" || r.lastStatus?.status === "skipped").length,
  }), [list]);

  // Progress bar: time to next automation run
  const progressPercent = useMemo(() => {
    if (!nextRunTimestamp) return 0;
    const remaining = Math.max(0, nextRunTimestamp - nowMs);
    return Math.min(100, Math.max(0, ((PROCESS_INTERVAL_MS - remaining) / PROCESS_INTERVAL_MS) * 100));
  }, [nextRunTimestamp, nowMs]);

  const secondsRemaining = useMemo(() => {
    if (!nextRunTimestamp) return 0;
    return Math.max(0, Math.ceil((nextRunTimestamp - nowMs) / 1000));
  }, [nextRunTimestamp, nowMs]);

  const padding = compact ? "p-2" : "p-3";
  const spacing = compact ? "space-y-2" : "space-y-3";

  return (
    <div className={`${padding} ${spacing} overflow-y-auto`}>
      {/* Summary stats */}
      <div className={cn("flex items-center gap-3", compact ? "text-xs" : "text-sm")}>
        <div className="flex items-center gap-1.5">
          <span className="text-gold/60">Realms:</span>
          <span className="text-gold font-medium">{list.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 font-medium">{activeCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="text-red-400 font-medium">{failedCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-amber-400 font-medium">{skippedCount}</span>
        </div>
      </div>

      {/* Next run progress bar */}
      {nextRunTimestamp && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gold/50">Next run:</span>
          <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold/60 transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[9px] text-gold/50 tabular-nums w-8 text-right">{secondsRemaining}s</span>
        </div>
      )}

      {/* Realm list */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bot className="w-10 h-10 text-gold/30 mb-2" />
          <p className="text-gold/60 text-xs">No realms configured for automation.</p>
          <p className="text-gold/40 text-[10px] mt-1">Enable production automation on a realm to see it here.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((realm) => {
            const severity = getFailureSeverity(realm.lastStatus);
            const isCritical = severity === "critical";

            return (
              <div
                key={realm.realmId}
                className={cn(
                  "flex flex-col rounded-lg border p-2 transition-all",
                  getRealmStatusBorder(realm.lastStatus),
                )}
              >
                <div className="flex items-center justify-between">
                  {/* Left side - realm info */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <Bot className="w-4 h-4 text-gold/70" />
                      {realm.lastStatus?.status === "success" && (
                        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      {isCritical && (
                        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gold/90 truncate">
                          {realm.realmName || `Realm #${realm.realmId}`}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                            getPresetPillClass(realm.presetId),
                          )}
                        >
                          {getPresetLabel(realm.presetId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusDotBg(realm.lastStatus?.status))}
                        />
                        <span className={cn("text-[10px] truncate", getRealmStatusColor(realm.lastStatus))}>
                          {getRealmStatusLabel(realm.lastStatus)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side - time ago */}
                  <div className="shrink-0 text-right">
                    {realm.lastStatus?.attemptedAt && (
                      <span className="text-[9px] text-gold/40">{timeAgo(realm.lastStatus.attemptedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Critical failure inline error */}
                {isCritical && realm.lastStatus?.message && (
                  <div className="mt-1.5 rounded border border-red-500/30 bg-red-500/5 px-2 py-1">
                    <span className="text-[10px] text-red-400">
                      {realm.lastStatus.consecutiveFailures} consecutive failures: {realm.lastStatus.message}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ProductionAutomationWindow = memo(() => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(productionAutomation));

  return (
    <OSWindow
      onClick={() => togglePopup(productionAutomation)}
      show={isOpen}
      title="Production Automation"
      width="340px"
      height="auto"
    >
      <ProductionAutomationContent compact />
    </OSWindow>
  );
});
