import { useConnectionStore, type StreamStatus } from "@/hooks/store/use-connection-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Globe from "lucide-react/dist/esm/icons/globe";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import { useEffect, useMemo, useState } from "react";

interface NetworkStatusPillProps {
  onRetry: () => void | Promise<void>;
}

const formatAge = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
};

const pickLabel = (spatial: StreamStatus, global: StreamStatus, overall: string): string => {
  if (overall === "disconnected") return "Offline";
  if (spatial === "reconnecting" || global === "reconnecting") return "Reconnecting…";
  return "Sync lag";
};

const pickTone = (overall: string): { container: string; text: string; ring: string; dot: string } => {
  if (overall === "disconnected") {
    return {
      container: "border-danger/60 bg-danger/15 hover:bg-danger/25",
      text: "text-danger",
      ring: "focus-visible:ring-danger/50",
      dot: "bg-danger",
    };
  }
  return {
    container: "border-orange/60 bg-orange/15 hover:bg-orange/25",
    text: "text-orange",
    ring: "focus-visible:ring-orange/50",
    dot: "bg-orange",
  };
};

export const NetworkStatusPill = ({ onRetry }: NetworkStatusPillProps) => {
  const status = useConnectionStore((s) => s.status);
  const spatialStatus = useConnectionStore((s) => s.spatialStatus);
  const globalStatus = useConnectionStore((s) => s.globalStatus);
  const lastSpatialUpdate = useConnectionStore((s) => s.lastSpatialUpdate);
  const lastGlobalUpdate = useConnectionStore((s) => s.lastGlobalUpdate);
  const reconnectAttempts = useConnectionStore((s) => s.reconnectAttempts);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === "connected") return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [status]);

  const reconnecting = spatialStatus === "reconnecting" || globalStatus === "reconnecting";
  const spatialSick = spatialStatus !== "connected";
  const globalSick = globalStatus !== "connected";

  const tooltip = useMemo(
    () =>
      [
        `Spatial: ${spatialStatus} · ${formatAge(now - lastSpatialUpdate)} ago`,
        `Global: ${globalStatus} · ${formatAge(now - lastGlobalUpdate)} ago`,
        reconnectAttempts > 0 ? `Reconnect attempt ${reconnectAttempts}` : null,
        "Click to retry",
      ]
        .filter(Boolean)
        .join("\n"),
    [spatialStatus, globalStatus, lastSpatialUpdate, lastGlobalUpdate, now, reconnectAttempts],
  );

  if (status === "connected") return null;

  const tone = pickTone(status);
  const label = pickLabel(spatialStatus, globalStatus, status);

  return (
    <button
      type="button"
      title={tooltip}
      onClick={() => {
        if (!reconnecting) void onRetry();
      }}
      disabled={reconnecting}
      aria-label={`Network ${label}. Click to retry.`}
      className={cn(
        "relative inline-flex h-9 md:h-10 items-center gap-2 rounded-full border px-3.5 md:px-4 text-[11px] md:text-xs font-semibold uppercase tracking-[0.16em] tabular-nums",
        "transition-colors focus:outline-none focus-visible:ring-2",
        tone.container,
        tone.text,
        tone.ring,
        reconnecting && "cursor-wait",
      )}
    >
      <span
        className={cn(
          "inline-flex h-2 w-2 rounded-full shadow-[0_0_6px_currentColor]",
          tone.dot,
          reconnecting && "animate-pulse",
        )}
      />
      {status === "disconnected" && !reconnecting ? (
        <WifiOff className="h-3 w-3" aria-hidden />
      ) : (
        <>
          {spatialSick ? <MapPin className="h-3 w-3" aria-hidden /> : null}
          {globalSick ? <Globe className="h-3 w-3" aria-hidden /> : null}
        </>
      )}
      <span>{label}</span>
    </button>
  );
};
