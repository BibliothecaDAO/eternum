import type { RealmExecutionStatus } from "@/hooks/store/use-automation-store";

const PROCESS_INTERVAL_MS = 60 * 1000;

export function getRealmStatusColor(status?: RealmExecutionStatus): string {
  if (!status) return "text-gold/50";
  switch (status.status) {
    case "success":
      return "text-emerald-400";
    case "failed":
      return "text-danger";
    case "skipped":
      return "text-amber-400";
    default:
      return "text-gold/50";
  }
}

export function getRealmStatusBorder(status?: RealmExecutionStatus): string {
  if (!status) return "border-gold/20 bg-black/30";
  switch (status.status) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/5";
    case "failed":
      return "border-red-500/30 bg-red-500/5";
    case "skipped":
      return "border-amber-500/30 bg-amber-500/5";
    default:
      return "border-gold/20 bg-black/30";
  }
}

export function getRealmStatusLabel(status?: RealmExecutionStatus): string {
  if (!status) return "Pending";
  switch (status.status) {
    case "success":
      return "Success";
    case "failed":
      return status.message ? `Failed: ${status.message}` : "Failed";
    case "skipped":
      return status.message ? `Skipped: ${status.message}` : "Skipped";
    default:
      return "Unknown";
  }
}

export function isRealmStale(status?: RealmExecutionStatus, intervalMs: number = PROCESS_INTERVAL_MS): boolean {
  if (!status) return false;
  return Date.now() - status.attemptedAt > 3 * intervalMs;
}

export function getFailureSeverity(status?: RealmExecutionStatus): "none" | "warning" | "critical" {
  if (!status || status.consecutiveFailures === 0) return "none";
  if (status.consecutiveFailures < 3) return "warning";
  return "critical";
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
