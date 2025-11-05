import { resubscribeEntityStream } from "@/dojo/sync";
import { useNetworkStatusStore } from "@/hooks/store/use-network-status-store";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { useDojo } from "@bibliothecadao/react";
import { AlertCircle, Loader2, RefreshCw, WifiOff, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const formatElapsed = (elapsedMs: number | null) => {
  if (!elapsedMs) return null;
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
};

export const NetworkDesyncIndicator = () => {
  const status = useNetworkStatusStore((state) => state.getStatus());
  const clearForcedDesync = useNetworkStatusStore((state) => state.clearForcedDesync);
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const showRefreshAction = status.reason === "pending-tx";

  useEffect(() => {
    if (!status.isDesynced) {
      setIsDismissed(false);
    }
  }, [status.isDesynced]);

  useEffect(() => {
    setIsDismissed(false);
  }, [status.reason]);

  const {
    setup,
    setup: {
      network: { provider },
    },
  } = useDojo();

  const description = useMemo(() => {
    if (!status.isDesynced) return null;

    if (status.reason === "forced") {
      return {
        headline: "Desync forced for testing",
        body: "Clear the forced mode or wait for the timer to expire.",
        icon: AlertCircle,
      } as const;
    }

    if (status.reason === "no-heartbeat") {
      return {
        headline: "Awaiting first heartbeat",
        body: "The client hasn't heard from the network yet.",
        icon: WifiOff,
      } as const;
    }

    if (status.reason === "pending-tx") {
      const elapsed = formatElapsed(status.elapsedMs);
      return {
        headline: "Transaction pending",
        body: elapsed ? `Still waiting after ${elapsed}.` : "Transaction still pending...",
        highlight: true,
        icon: Loader2,
      } as const;
    }

    const elapsed = formatElapsed(status.elapsedMs);
    const blockInfo =
      status.heartbeat?.blockNumber !== undefined && status.heartbeat?.blockNumber !== null
        ? ` (block ${status.heartbeat.blockNumber})`
        : "";

    if (!elapsed) {
      return {
        headline: "No recent updates",
        body: `Waiting for network activity${blockInfo}.`,
        icon: WifiOff,
      } as const;
    }

    return {
      headline: "Connection behind",
      body: `Last update ${elapsed} ago${blockInfo}.`,
      icon: WifiOff,
    } as const;
  }, [status]);

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
  }, []);

  if (!status.isDesynced || !description || isDismissed) {
    return null;
  }

  const Icon = description.icon;

  return (
    <div className="pointer-events-auto fixed left-1/2 top-24 z-[1100] w-full max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative rounded-xl border border-amber-500/30 bg-gradient-to-br from-[#2a2318] to-[#1f1a12] p-5 shadow-2xl backdrop-blur-sm">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-amber-200/60 transition-colors hover:bg-amber-500/10 hover:text-amber-200"
          aria-label="Dismiss desync notice"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {isResyncing ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden />
            ) : (
              <div className={`rounded-full p-2 ${description.highlight ? "bg-red-500/20" : "bg-amber-500/20"}`}>
                <Icon className={`h-5 w-5 ${description.highlight ? "text-red-400" : "text-amber-400"}`} aria-hidden />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-amber-100">{description.headline}</h4>
            <p className="text-sm text-amber-200/80">{description.body}</p>
            {lastError && (
              <div className="mt-2 rounded-md bg-red-500/10 p-2 text-xs text-red-300">
                <span className="font-medium">Error:</span> {lastError}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {showRefreshAction ? (
            <Button variant="primary" size="xs" onClick={handleRefreshClient} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh client
            </Button>
          ) : (
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
                  Re-syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Resume from latest block
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusDot = memo(({ highlight }: { highlight?: boolean }) => (
  <span className={`mt-1 inline-block h-3 w-3 rounded-full ${highlight ? "bg-red-400" : "bg-amber-200"}`} aria-hidden />
));
