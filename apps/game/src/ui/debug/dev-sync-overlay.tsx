import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { useEffect, useState } from "react";

const formatAge = (timestamp: number, now: number): string => {
  if (!timestamp) return "—";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${(seconds % 60).toString().padStart(2, "0")}s`;
};

/**
 * Dev-mode sync readout (bottom-left): connection status plus the age of the
 * last data on each stream — the fastest way to tell "the world is quiet"
 * from "sync is dead". FPS/memory live in the stats panel.
 */
export const DevSyncOverlay = () => {
  const status = useConnectionStore((state) => state.status);
  const spatialStatus = useConnectionStore((state) => state.spatialStatus);
  const globalStatus = useConnectionStore((state) => state.globalStatus);
  const lastSpatialUpdate = useConnectionStore((state) => state.lastSpatialUpdate);
  const lastGlobalUpdate = useConnectionStore((state) => state.lastGlobalUpdate);
  const reconnectAttempts = useConnectionStore((state) => state.reconnectAttempts);
  const streamReconnectVersion = useConnectionStore((state) => state.streamReconnectVersion);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!DEV_MODE_ENABLED) return null;

  const statusColor = status === "connected" ? "#6fae7d" : status === "degraded" ? "#d9a83f" : "#e06a5c";

  return (
    <div
      className="pointer-events-none fixed bottom-2 left-2 z-[90] rounded bg-black/70 px-2.5 py-1.5 font-mono text-[10px] leading-4 text-white/80"
      data-testid="dev-sync-overlay"
    >
      <div>
        sync <span style={{ color: statusColor }}>{status}</span> · spatial {spatialStatus} · global {globalStatus}
      </div>
      <div>
        last data: spatial {formatAge(lastSpatialUpdate, now)} · global {formatAge(lastGlobalUpdate, now)}
      </div>
      <div>
        reconnects {streamReconnectVersion} · failed attempts {reconnectAttempts}
      </div>
    </div>
  );
};
