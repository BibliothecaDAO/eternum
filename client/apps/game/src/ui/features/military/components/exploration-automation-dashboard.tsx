import { useMemo, useCallback, useState, useEffect } from "react";
import { Bot, MapPin, Pause, Play, Square, Trash2 } from "lucide-react";
import { useExplorationAutomationStore, type ExplorationAutomationEntry } from "@/hooks/store/use-exploration-automation-store";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ModalContainer } from "@/ui/shared";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { toast } from "sonner";

const formatRelativeTime = (timestamp?: number | null): string => {
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

const getStatusLabel = (entry: ExplorationAutomationEntry): string => {
  if (!entry.active) return "Paused";
  if (entry.blockedReason) return `Blocked: ${entry.blockedReason}`;
  return "Active";
};

const getStatusColor = (entry: ExplorationAutomationEntry): string => {
  if (!entry.active) return "text-gold/50";
  if (entry.blockedReason) return "text-amber-400";
  return "text-emerald-400";
};

interface ExplorerPosition {
  x: number;
  y: number;
}

export const ExplorationAutomationDashboard = () => {
  const entries = useExplorationAutomationStore((s) => s.entries);
  const toggleActive = useExplorationAutomationStore((s) => s.toggleActive);
  const remove = useExplorationAutomationStore((s) => s.remove);
  const pauseAll = useExplorationAutomationStore((s) => s.pauseAll);
  const resumeAll = useExplorationAutomationStore((s) => s.resumeAll);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const navigateToMapView = useNavigateToMapView();

  const {
    setup: { components },
  } = useDojo();

  const list = useMemo(
    () => Object.values(entries).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [entries],
  );

  // Get explorer positions
  const [explorerPositions, setExplorerPositions] = useState<Record<string, ExplorerPosition>>({});

  useEffect(() => {
    if (!components) return;

    const positions: Record<string, ExplorerPosition> = {};
    list.forEach((entry) => {
      const explorerId = Number(entry.explorerId);
      if (!Number.isFinite(explorerId) || explorerId <= 0) return;

      const entity = getEntityIdFromKeys([BigInt(explorerId)]);
      const explorer = getComponentValue(components.ExplorerTroops, entity);
      if (explorer?.coord) {
        positions[entry.id] = {
          x: Number(explorer.coord.x),
          y: Number(explorer.coord.y),
        };
      }
    });
    setExplorerPositions(positions);
  }, [components, list]);

  const handlePauseAll = useCallback(() => {
    const activeCount = list.filter((e) => e.active).length;
    if (activeCount === 0) {
      toast.info("No active automations to pause.");
      return;
    }
    pauseAll();
    toast.success(`Paused ${activeCount} exploration${activeCount > 1 ? "s" : ""}.`);
  }, [list, pauseAll]);

  const handleResumeAll = useCallback(() => {
    const pausedCount = list.filter((e) => !e.active).length;
    if (pausedCount === 0) {
      toast.info("No paused automations to resume.");
      return;
    }
    resumeAll();
    toast.success(`Resumed ${pausedCount} exploration${pausedCount > 1 ? "s" : ""}.`);
  }, [list, resumeAll]);

  const handleGoToExplorer = useCallback(
    (entry: ExplorationAutomationEntry) => {
      const pos = explorerPositions[entry.id];
      if (!pos) {
        toast.error("Explorer position unknown.");
        return;
      }
      toggleModal(null);
      navigateToMapView(new Position({ x: pos.x, y: pos.y }));
    },
    [explorerPositions, navigateToMapView, toggleModal],
  );

  const handleRemove = useCallback(
    (entry: ExplorationAutomationEntry) => {
      remove(entry.id);
      toast.success("Automation removed.");
    },
    [remove],
  );

  const activeCount = list.filter((e) => e.active).length;
  const pausedCount = list.filter((e) => !e.active).length;

  // Update positions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!components) return;
      const positions: Record<string, ExplorerPosition> = {};
      list.forEach((entry) => {
        const explorerId = Number(entry.explorerId);
        if (!Number.isFinite(explorerId) || explorerId <= 0) return;

        const entity = getEntityIdFromKeys([BigInt(explorerId)]);
        const explorer = getComponentValue(components.ExplorerTroops, entity);
        if (explorer?.coord) {
          positions[entry.id] = {
            x: Number(explorer.coord.x),
            y: Number(explorer.coord.y),
          };
        }
      });
      setExplorerPositions(positions);
    }, 5000);

    return () => clearInterval(interval);
  }, [components, list]);

  // Force re-render for relative times
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ModalContainer size="medium" title="Exploration Automations">
      <div className="p-4 space-y-4 h-full overflow-y-auto">
        {/* Summary stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gold/60">Total:</span>
            <span className="text-gold font-medium">{list.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-gold/60">Active:</span>
            <span className="text-emerald-400 font-medium">{activeCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold/50" />
            <span className="text-gold/60">Paused:</span>
            <span className="text-gold/50 font-medium">{pausedCount}</span>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={handlePauseAll} disabled={activeCount === 0}>
            <Pause className="w-3 h-3 mr-1" />
            Pause All
          </Button>
          <Button size="xs" variant="outline" onClick={handleResumeAll} disabled={pausedCount === 0}>
            <Play className="w-3 h-3 mr-1" />
            Resume All
          </Button>
        </div>

        {/* Entry list */}
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="w-12 h-12 text-gold/30 mb-3" />
            <p className="text-gold/60 text-sm">No exploration automations configured.</p>
            <p className="text-gold/40 text-xs mt-1">
              Enable auto-explore on an explorer to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((entry) => {
              const pos = explorerPositions[entry.id];
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-all",
                    entry.active
                      ? entry.blockedReason
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-emerald-500/30 bg-emerald-500/5"
                      : "border-gold/20 bg-black/30",
                  )}
                >
                  {/* Left side - info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <Bot className="w-5 h-5 text-gold/70" />
                      {entry.active && !entry.blockedReason && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gold/90">
                          Explorer #{entry.explorerId}
                        </span>
                        <span className={cn("text-xs", getStatusColor(entry))}>
                          {getStatusLabel(entry)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gold/50">
                        {pos && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            ({pos.x}, {pos.y})
                          </span>
                        )}
                        <span>Radius: {entry.scopeRadius}</span>
                        {entry.lastAction && <span>Last: {entry.lastAction}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gold/40 mt-0.5">
                        <span>Ran: {formatRelativeTime(entry.lastRunAt)}</span>
                        {entry.active && <span>Next: {formatRelativeTime(entry.nextRunAt)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right side - actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleGoToExplorer(entry)}
                      disabled={!pos}
                      className={cn(
                        "flex items-center justify-center rounded p-2 transition-all",
                        pos
                          ? "text-gold/60 hover:bg-gold/10 hover:text-gold"
                          : "text-gold/20 cursor-not-allowed",
                      )}
                      title="Go to location"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(entry.id)}
                      className={cn(
                        "flex items-center justify-center rounded p-2 transition-all",
                        entry.active
                          ? "text-gold/60 hover:bg-gold/10 hover:text-gold"
                          : "text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400",
                      )}
                      title={entry.active ? "Pause" : "Resume"}
                    >
                      {entry.active ? (
                        <Square className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(entry)}
                      className="flex items-center justify-center rounded p-2 text-red-400/60 transition-all hover:bg-red-500/10 hover:text-red-400"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalContainer>
  );
};
