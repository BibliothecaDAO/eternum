import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import X from "lucide-react/dist/esm/icons/x";
import { useEffect, useState } from "react";

const OUTAGE_BANNER_THRESHOLD_MS = 30_000;
const OUTAGE_BANNER_ATTEMPT_THRESHOLD = 3;

interface NetworkStatusBannerProps {
  onRetry: () => void | Promise<void>;
}

export const NetworkStatusBanner = ({ onRetry }: NetworkStatusBannerProps) => {
  const status = useConnectionStore((s) => s.status);
  const spatialStatus = useConnectionStore((s) => s.spatialStatus);
  const globalStatus = useConnectionStore((s) => s.globalStatus);
  const lastDisconnectedAt = useConnectionStore((s) => s.lastDisconnectedAt);
  const reconnectAttempts = useConnectionStore((s) => s.reconnectAttempts);

  const [now, setNow] = useState(() => Date.now());
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const outageLongEnough = lastDisconnectedAt !== null && now - lastDisconnectedAt >= OUTAGE_BANNER_THRESHOLD_MS;
  const manyAttempts = reconnectAttempts >= OUTAGE_BANNER_ATTEMPT_THRESHOLD;
  const dismissedThisOutage = dismissedAt !== null && lastDisconnectedAt !== null && lastDisconnectedAt <= dismissedAt;

  const visible = status !== "connected" && (outageLongEnough || manyAttempts) && !dismissedThisOutage;
  const reconnecting = spatialStatus === "reconnecting" || globalStatus === "reconnecting";

  const message =
    status === "disconnected" ? "Disconnected from the realm" : reconnecting ? "Reconnecting…" : "Sync is lagging";

  const submessage = lastDisconnectedAt
    ? `Offline for ${Math.max(0, Math.floor((now - lastDisconnectedAt) / 1000))}s · Attempt ${reconnectAttempts}`
    : `Attempt ${reconnectAttempts}`;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="network-status-banner"
          initial={{ y: -32, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-16 z-30 flex justify-center px-4"
        >
          <div className="w-[520px] max-w-full">
            <div className="panel-wood panel-wood-corners pointer-events-auto relative overflow-hidden rounded-xl border border-gold/20 bg-dark-wood text-gold shadow-[0_25px_45px_-25px_rgba(0,0,0,0.8)]">
              <div className="corner-bl z-100" />
              <div className="corner-br z-100" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
              <div
                className={cn(
                  "pointer-events-none absolute inset-y-4 left-0 w-[2px] rounded-full",
                  status === "disconnected" ? "bg-anger-light/80" : "bg-orange/80",
                )}
              />

              <div className="relative grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
                <div className="flex justify-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)]",
                      status === "disconnected"
                        ? "border-anger-light/35 bg-anger-light/10 text-anger-light"
                        : "border-orange/35 bg-orange/10 text-orange",
                    )}
                  >
                    <AlertTriangle className={cn("h-[18px] w-[18px]", reconnecting && "animate-pulse")} aria-hidden />
                  </div>
                </div>

                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-[0.38em]",
                      status === "disconnected" ? "text-anger-light" : "text-orange",
                    )}
                  >
                    Network
                  </div>
                  <div className="mt-1 font-[Cinzel] text-sm font-semibold uppercase tracking-[0.2em] text-gold">
                    {message}
                  </div>
                  <div className="mt-1 text-[12px] leading-[1.35] text-gold/78">{submessage}</div>
                </div>

                <div className="relative flex min-h-[52px] flex-col items-center justify-center gap-1.5 pl-3 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-gold/10">
                  <button
                    type="button"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      void onRetry();
                    }}
                    disabled={reconnecting}
                    className={cn(
                      "button-wood inline-flex h-9 w-11 flex-col items-center justify-center gap-0.5 rounded-md border text-[8px] font-semibold uppercase tracking-[0.16em] transition-colors",
                      "border-gold/25 bg-black/20 text-gold hover:border-gold/45 hover:bg-black/35",
                      reconnecting && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <RotateCcw className={cn("h-3 w-3", reconnecting && "animate-spin")} />
                    <span>Retry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedAt(Date.now())}
                    className="button-wood inline-flex h-7 w-7 items-center justify-center rounded-full border-gold/15 bg-black/20 p-0 text-gold/45 hover:bg-black/35 hover:text-gold"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
