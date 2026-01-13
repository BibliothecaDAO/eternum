import { useMemo } from "react";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";

interface StatusBeaconProps {
  onClick?: () => void;
}

export const StatusBeacon = ({ onClick }: StatusBeaconProps) => {
  const transactions = useTransactionStore((state) => state.transactions);
  const stuckThresholdMs = useTransactionStore((state) => state.stuckThresholdMs);

  const { status, pendingCount, stuckCount, hasRecentError } = useMemo(() => {
    const now = Date.now();

    const pending = transactions.filter((t) => t.status === "pending");
    const stuck = pending.filter((t) => now - t.submittedAt >= stuckThresholdMs);
    const recentReverted = transactions.some(
      (t) => t.status === "reverted" && t.confirmedAt && now - t.confirmedAt < 60_000,
    );

    let overallStatus: "idle" | "pending" | "stuck" | "error" = "idle";
    if (recentReverted) overallStatus = "error";
    else if (stuck.length > 0) overallStatus = "stuck";
    else if (pending.length > 0) overallStatus = "pending";

    return {
      status: overallStatus,
      pendingCount: pending.length,
      stuckCount: stuck.length,
      hasRecentError: recentReverted,
    };
  }, [transactions, stuckThresholdMs]);

  const beaconColorClass = useMemo(() => {
    switch (status) {
      case "error":
        return "bg-danger";
      case "stuck":
        return "bg-orange";
      case "pending":
        return "bg-gold";
      default:
        return "bg-brilliance";
    }
  }, [status]);

  const glowColorClass = useMemo(() => {
    switch (status) {
      case "error":
        return "shadow-[0_0_12px_rgba(200,68,68,0.6)]";
      case "stuck":
        return "shadow-[0_0_12px_rgba(254,153,60,0.6)]";
      case "pending":
        return "shadow-[0_0_12px_rgba(223,170,84,0.6)]";
      default:
        return "shadow-[0_0_8px_rgba(125,255,186,0.4)]";
    }
  }, [status]);

  const shouldPulse = status === "pending" || status === "stuck";

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-brown/90 border border-gold/30
                 hover:border-gold/50 hover:bg-gold/10 transition-all duration-200 cursor-pointer"
      aria-label="Transaction status"
    >
      {/* Beacon dot */}
      <div className="relative flex items-center justify-center">
        <div
          className={`w-3 h-3 rounded-full ${beaconColorClass} ${glowColorClass}
                      ${shouldPulse ? "animate-pulse" : ""} transition-colors duration-300`}
        />
        {/* Outer ring for emphasis when there are issues */}
        {(status === "error" || status === "stuck") && (
          <div
            className={`absolute inset-0 w-3 h-3 rounded-full ${beaconColorClass} opacity-30
                        animate-ping`}
          />
        )}
      </div>

      {/* Status text */}
      <span className="text-xs text-gold/80 group-hover:text-gold transition-colors">
        {status === "idle" && "All clear"}
        {status === "pending" && `${pendingCount} pending`}
        {status === "stuck" && `${stuckCount} stuck`}
        {status === "error" && (hasRecentError ? "Error" : `${pendingCount} pending`)}
      </span>

      {/* Pending count badge */}
      {pendingCount > 0 && status !== "idle" && (
        <div
          className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold
                      ${status === "error" ? "bg-danger text-white" : ""}
                      ${status === "stuck" ? "bg-orange text-dark-brown" : ""}
                      ${status === "pending" ? "bg-gold text-dark-brown" : ""}`}
        >
          {pendingCount}
        </div>
      )}
    </button>
  );
};
