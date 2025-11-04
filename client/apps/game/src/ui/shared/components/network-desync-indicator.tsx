import { resubscribeEntityStream } from "@/dojo/sync";
import { useNetworkStatusStore } from "@/hooks/store/use-network-status-store";
import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { useDojo } from "@bibliothecadao/react";
import { useCallback, useMemo, useState } from "react";
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

  const {
    setup,
    setup: {
      network: { provider },
    },
  } = useDojo();

  const description = useMemo(() => {
    if (!status.isDesynced) return null;
    if (status.reason === "forced") {
      return "Desync forced for testing";
    }
    if (status.reason === "no-heartbeat") {
      return "Waiting for first network update";
    }
    if (status.reason === "pending-tx") {
      const elapsed = formatElapsed(status.elapsedMs);
      if (!elapsed) return "A transaction is still pending";
      return `Transaction pending for ${elapsed}`;
    }
    const elapsed = formatElapsed(status.elapsedMs);
    const blockInfo =
      status.heartbeat?.blockNumber !== undefined && status.heartbeat?.blockNumber !== null
        ? ` (block ${status.heartbeat.blockNumber})`
        : "";
    if (!elapsed) return `Waiting for network updates${blockInfo}`;
    return `Last update ${elapsed} ago${blockInfo}`;
  }, [status]);

  const handleResync = useCallback(async () => {
    if (isResyncing) return;
    setIsResyncing(true);
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
    } finally {
      setIsResyncing(false);
    }
  }, [clearForcedDesync, isResyncing, provider, setup]);

  if (!status.isDesynced) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed left-1/2 bottom-20 z-[1100] w-full max-w-xs -translate-x-1/2 rounded-lg border border-amber-500/40 bg-[#1f1a12f0] p-4 text-center text-xs text-white shadow-lg">
      <p className="font-semibold text-amber-200">Connection desynced</p>
      <p className="mt-2 text-white/80">{description}</p>
      <div className="mt-3 flex justify-center gap-2">
        <Button variant="secondary" size="xs" disabled={isResyncing} onClick={handleResync}>
          {isResyncing ? "Attempting reconnect..." : "Resume from latest block"}
        </Button>
      </div>
    </div>
  );
};
