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
  resolved: "border-gold/55 bg-gold/20 text-gold",
  settling: "border-gold/40 bg-gold/10 text-gold",
  pending: "border-gold/25 bg-brown/45 text-gold/80",
  upcoming: "border-gold/25 bg-brown/45 text-gold/80",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
  default: "border-gold/25 bg-brown/45 text-gold/80",
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
  const rawStatus = String((market as { status?: string }).status ?? "").toLowerCase();

  const computedStatus = ((): StatusKey => {
    if (rawStatus.includes("cancel")) return "cancelled";
    if (rawStatus.includes("upcoming") || rawStatus.includes("pending")) return "upcoming";
    if (market.isResolved()) return "resolved";
    if (market.isResolvable()) return "resolvable";
    if (market.isEnded()) return "closed";
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
