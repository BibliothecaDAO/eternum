import { resubscribeEntityStream } from "@/dojo/sync";
import { useNetworkStatusStore, type WarningLevel } from "@/hooks/store/use-network-status-store";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { useDojo } from "@bibliothecadao/react";
import { AlertCircle, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const formatElapsed = (elapsedMs: number | null) => {
  if (!elapsedMs) return null;
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
};

interface IndicatorConfig {
  headline: string;
  body: string;
  icon: typeof Clock;
  variant: "subtle" | "warning" | "urgent";
  showActions: boolean;
}

const getIndicatorConfig = (
  warningLevel: WarningLevel,
  reason: string | null,
  elapsedMs: number | null,
): IndicatorConfig | null => {
  const elapsed = formatElapsed(elapsedMs);

  if (reason === "forced") {
    return {
      headline: "Desync forced for testing",
      body: "Clear the forced mode or wait for the timer to expire.",
      icon: AlertCircle,
      variant: "urgent",
      showActions: true,
    };
  }

  if (reason === "pending-tx") {
    switch (warningLevel) {
      case "waiting":
        return {
          headline: "Transaction processing",
          body: elapsed ? `Waiting ${elapsed}...` : "Processing...",
          icon: Clock,
          variant: "subtle",
          showActions: false,
        };
      case "delayed":
        return {
          headline: "Transaction taking longer than usual",
          body: elapsed ? `Still waiting after ${elapsed}.` : "Still processing...",
          icon: Loader2,
          variant: "warning",
          showActions: false,
        };
      case "desync":
        return {
          headline: "Transaction may have failed",
          body: elapsed ? `No confirmation after ${elapsed}. Consider refreshing.` : "No confirmation received.",
          icon: AlertCircle,
          variant: "urgent",
          showActions: true,
        };
      default:
        return null;
    }
  }

  return null;
};

export const NetworkDesyncIndicator = () => {
  const status = useNetworkStatusStore((state) => state.getStatus());
  const clearForcedDesync = useNetworkStatusStore((state) => state.clearForcedDesync);
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [dismissedLevel, setDismissedLevel] = useState<WarningLevel | null>(null);

  // Reset dismissal when warning level changes to a higher severity
  useEffect(() => {
    if (status.warningLevel === "normal") {
      setIsDismissed(false);
      setDismissedLevel(null);
    } else if (dismissedLevel && status.warningLevel !== dismissedLevel) {
      // Re-show if escalated to a more severe level
      const levels: WarningLevel[] = ["normal", "waiting", "delayed", "desync"];
      const currentIndex = levels.indexOf(status.warningLevel);
      const dismissedIndex = levels.indexOf(dismissedLevel);
      if (currentIndex > dismissedIndex) {
        setIsDismissed(false);
        setDismissedLevel(null);
      }
    }
  }, [status.warningLevel, dismissedLevel]);

  const {
    setup,
    setup: {
      network: { provider },
    },
  } = useDojo();

  const config = useMemo(
    () => getIndicatorConfig(status.warningLevel, status.reason, status.elapsedMs),
    [status.warningLevel, status.reason, status.elapsedMs],
  );

  const handleResync = useCallback(async () => {
    if (isResyncing) return;
    setIsResyncing(true);
    setLastError(null);
    try {
      const uiStore = useUIStore.getState();
      const { setInitialSyncProgress } = useSyncStore.getState();
      await resubscribeEntityStream(setup, uiStore, setInitialSyncProgress, true);
      clearForcedDesync();
      provider.simulateHeartbeat({ source: "stream" });
      toast.success("Reconnected to game state stream");
    } catch (error) {
      console.error("[DESYNC] Failed to resubscribe", error);
      toast.error("Unable to resubscribe to the network stream");
      setLastError(error instanceof Error ? error.message : "Unknown error during resync");
    } finally {
      setIsResyncing(false);
    }
  }, [clearForcedDesync, isResyncing, provider, setup]);

  const handleRefreshClient = useCallback(() => {
    if (typeof window === "undefined") return;
    window.location.reload();
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setDismissedLevel(status.warningLevel);
  }, [status.warningLevel]);

  // Don't show anything for normal state or if dismissed
  if (status.warningLevel === "normal" || !config || isDismissed) {
    return null;
  }

  const Icon = config.icon;

  // Subtle indicator for "waiting" level - small pill in corner
  if (config.variant === "subtle") {
    return (
      <div className="pointer-events-auto fixed right-4 top-4 z-[1100] animate-in fade-in slide-in-from-right-2 duration-300">
        <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-[#1f1a12]/90 px-3 py-1.5 text-xs text-amber-200/80 shadow-lg backdrop-blur-sm">
          <Icon className="h-3.5 w-3.5 animate-pulse" />
          <span>{config.headline}</span>
          {status.elapsedMs && <span className="text-amber-200/60">{formatElapsed(status.elapsedMs)}</span>}
          <button
            onClick={handleDismiss}
            className="ml-1 rounded p-0.5 hover:bg-amber-500/10"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // Warning or urgent modal
  const borderColor = config.variant === "urgent" ? "border-red-500/40" : "border-amber-500/30";
  const iconBgColor = config.variant === "urgent" ? "bg-red-500/20" : "bg-amber-500/20";
  const iconColor = config.variant === "urgent" ? "text-red-400" : "text-amber-400";

  return (
    <div className="pointer-events-auto fixed left-1/2 top-24 z-[1100] w-full max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className={`relative rounded-xl border ${borderColor} bg-gradient-to-br from-[#2a2318] to-[#1f1a12] p-5 shadow-2xl backdrop-blur-sm`}>
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-amber-200/60 transition-colors hover:bg-amber-500/10 hover:text-amber-200"
          aria-label="Dismiss notice"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {isResyncing ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden />
            ) : (
              <div className={`rounded-full p-2 ${iconBgColor}`}>
                <Icon className={`h-5 w-5 ${iconColor} ${Icon === Loader2 ? "animate-spin" : ""}`} aria-hidden />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-amber-100">{config.headline}</h4>
            <p className="text-sm text-amber-200/80">{config.body}</p>
            {lastError && (
              <div className="mt-2 rounded-md bg-red-500/10 p-2 text-xs text-red-300">
                <span className="font-medium">Error:</span> {lastError}
              </div>
            )}
          </div>
        </div>

        {config.showActions && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="primary" size="xs" onClick={handleRefreshClient} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh client
            </Button>
            <Button
              variant="secondary"
              size="xs"
              disabled={isResyncing}
              onClick={handleResync}
              aria-busy={isResyncing}
              className="gap-1.5"
            >
              {isResyncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Re-syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Resume sync
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
