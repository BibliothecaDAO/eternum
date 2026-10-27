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
 * Dev-mode sync readout (bottom-left). Herald heads a live stream every second, so the head's age tells "sync is
 * dead" (it grows) from "the world is quiet" (only the data's age grows). FPS/memory live in the stats panel.
 */
export const DevSyncOverlay = () => {
  const status = useConnectionStore((state) => state.status);
  const lastHeadAt = useConnectionStore((state) => state.lastHeadAt);
  const lastDataAt = useConnectionStore((state) => state.lastGlobalUpdate);
  const reconnects = useConnectionStore((state) => state.reconnects);
  const failedAttempts = useConnectionStore((state) => state.failedAttempts);

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
        sync <span style={{ color: statusColor }}>{status}</span> · last head {formatAge(lastHeadAt, now)}
      </div>
      <div>last data {formatAge(lastDataAt, now)}</div>
      <div>
        reconnects {reconnects} · failed attempts {failedAttempts}
      </div>
    </div>
  );
};
