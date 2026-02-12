import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Circle from "lucide-react/dist/esm/icons/circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Hourglass from "lucide-react/dist/esm/icons/hourglass";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import type { LucideIcon } from "lucide-react";

import { MarketClass } from "@/pm/class";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type StatusKey =
  | "open"
  | "active"
  | "trading"
  | "closed"
  | "resolvable"
  | "resolved"
  | "settling"
  | "pending"
  | "upcoming"
  | "cancelled"
  | "default";

const STATUS_STYLES: Record<StatusKey, string> = {
  open: "border-brilliance/40 bg-brilliance/10 text-brilliance",
  active: "border-brilliance/40 bg-brilliance/10 text-brilliance",
  trading: "border-brilliance/40 bg-brilliance/10 text-brilliance",
  closed: "border-orange/40 bg-orange/10 text-orange",
  resolvable: "border-gold/40 bg-gold/10 text-gold",
  resolved: "border-blueish/40 bg-blueish/10 text-blueish",
  settling: "border-blueish/40 bg-blueish/10 text-blueish",
  pending: "border-lightest/30 bg-lightest/5 text-lightest/80",
  upcoming: "border-lightest/30 bg-lightest/5 text-lightest/80",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
  default: "border-lightest/30 bg-lightest/5 text-lightest/80",
};

const STATUS_ICONS: Record<StatusKey, LucideIcon> = {
  open: Circle,
  active: Circle,
  trading: Circle,
  closed: Clock,
  resolvable: Hourglass,
  resolved: CheckCircle,
  settling: Hourglass,
  pending: Clock,
  upcoming: Clock,
  cancelled: XCircle,
  default: Circle,
};

const formatStatus = (status?: unknown) => {
  if (typeof status !== "string") return "Unknown";
  if (!status) return "Unknown";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const MarketStatusBadge = ({ market }: { market: MarketClass }) => {
  const nowMs = Date.now();

  const startAtMs = Number(market.start_at ?? market.created_at) * 1_000;
  const resolveAtMs = Number(market.resolve_at) * 1_000;
  const endAtMs = Number(market.end_at) * 1_000;
  const resolvedAtMs = Number(market.resolved_at) * 1_000;

  const computedStatus = ((): StatusKey => {
    if (market.isResolved() || (Number.isFinite(resolvedAtMs) && resolvedAtMs > 0)) return "resolved";
    if (market.isResolvable() || (Number.isFinite(resolveAtMs) && resolveAtMs > 0 && resolveAtMs <= nowMs))
      return "resolvable";
    if (market.isEnded() || (Number.isFinite(endAtMs) && endAtMs > 0 && endAtMs <= nowMs)) return "closed";
    if (Number.isFinite(startAtMs) && startAtMs > nowMs) return "upcoming";
    return "open";
  })();

  const style = STATUS_STYLES[computedStatus] || STATUS_STYLES.default;
  const Icon = STATUS_ICONS[computedStatus] || STATUS_ICONS.default;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        style,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatStatus(computedStatus)}
    </span>
  );
};
