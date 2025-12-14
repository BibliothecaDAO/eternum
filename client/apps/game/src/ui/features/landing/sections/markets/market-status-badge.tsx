import { MarketClass } from "@/pm/class";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const STATUS_STYLES: Record<string, string> = {
  open: "border-brilliance/40 bg-brilliance/10 text-brilliance",
  active: "border-brilliance/40 bg-brilliance/10 text-brilliance",
  trading: "border-brilliance/40 bg-brilliance/10 text-brilliance",
  closed: "border-orange/40 bg-orange/10 text-orange",
  resolvable: "border-orange/40 bg-orange/10 text-orange",
  resolved: "border-blueish/40 bg-blueish/10 text-blueish",
  settling: "border-blueish/40 bg-blueish/10 text-blueish",
  pending: "border-lightest/30 bg-lightest/5 text-lightest/80",
  upcoming: "border-lightest/30 bg-lightest/5 text-lightest/80",
  cancelled: "border-danger/40 bg-danger/10 text-danger",
  default: "border-lightest/30 bg-lightest/5 text-lightest/80",
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

  const computedStatus = (() => {
    if (market.isResolved() || (Number.isFinite(resolvedAtMs) && resolvedAtMs > 0)) return "resolved";
    if (market.isResolvable() || (Number.isFinite(resolveAtMs) && resolveAtMs > 0 && resolveAtMs <= nowMs))
      return "resolvable";
    if (market.isEnded() || (Number.isFinite(endAtMs) && endAtMs > 0 && endAtMs <= nowMs)) return "closed";
    if (Number.isFinite(startAtMs) && startAtMs > nowMs) return "upcoming";
    return "open";
  })();

  const normalized = computedStatus.toLowerCase();
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.default;

  return (
    <span className={cx("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", style)}>
      {formatStatus(computedStatus)}
    </span>
  );
};
