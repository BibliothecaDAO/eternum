import { resubscribeEntityStream } from "@/dojo/sync";
import { useNetworkStatusStore } from "@/hooks/store/use-network-status-store";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { useDojo } from "@bibliothecadao/react";
import { Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
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
      } as const;
    }

    if (status.reason === "no-heartbeat") {
      return {
        headline: "Awaiting first heartbeat",
        body: "The client hasn't heard from the network yet.",
      } as const;
    }

    if (status.reason === "pending-tx") {
      const elapsed = formatElapsed(status.elapsedMs);
      return {
        headline: "Transaction pending",
        body: elapsed ? `Still waiting after ${elapsed}.` : "Transaction still pending...",
        highlight: true,
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
      } as const;
    }

    return {
      headline: "Connection behind",
      body: `Last update ${elapsed} ago${blockInfo}.`,
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

  if (!status.isDesynced) {
    return null;
  }

  if (!description) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed left-1/2 bottom-20 z-[1100] w-full max-w-xs -translate-x-1/2 rounded-lg border border-amber-500/40 bg-[#1f1a12f0] p-4 text-left text-xs text-white shadow-lg">
      <div className="flex items-start gap-2">
        {isResyncing ? (
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-amber-200" aria-hidden />
        ) : (
          <StatusDot highlight={Boolean(description.highlight)} />
        )}
        <div className="flex-1">
          <p className="font-semibold text-amber-200">{description.headline}</p>
          <p className="mt-1 text-white/80">{description.body}</p>
          {lastError ? <p className="mt-1 text-amber-400">{lastError}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Button variant="secondary" size="xs" disabled={isResyncing} onClick={handleResync} aria-busy={isResyncing}>
          {isResyncing ? "Re-syncing…" : "Resume from latest block"}
        </Button>
      </div>
    </div>
  );
};

const StatusDot = memo(({ highlight }: { highlight?: boolean }) => (
  <span className={`mt-1 inline-block h-3 w-3 rounded-full ${highlight ? "bg-red-400" : "bg-amber-200"}`} aria-hidden />
));
