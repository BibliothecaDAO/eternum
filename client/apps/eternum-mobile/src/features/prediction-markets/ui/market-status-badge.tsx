import { MarketClass } from "@/pm/class";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const STATUS_STYLES: Record<string, string> = {
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  upcoming: "border-muted/60 bg-muted/20 text-muted-foreground",
  closed: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  resolvable: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  resolved: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  default: "border-muted/60 bg-muted/20 text-muted-foreground",
};

const formatStatus = (status?: string) => {
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
