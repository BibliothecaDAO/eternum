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
  const statusRaw = (market as any).status || (market as any).state;
  const now = Math.floor(Date.now() / 1_000);

  const startAt = Number((market as any).start_at ?? (market as any).created_at);
  const resolveAt = Number((market as any).resolve_at);
  const resolvedAt = Number((market as any).resolved_at);

  const computedStatus =
    Number.isFinite(resolvedAt) && resolvedAt > 0
      ? "resolved"
      : Number.isFinite(resolveAt) && resolveAt <= now
        ? "resolvable"
        : Number.isFinite(startAt) && startAt > now
          ? "upcoming"
          : undefined;

  const normalized = (computedStatus ?? (typeof statusRaw === "string" ? statusRaw : "unknown")).toLowerCase();
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.default;

  return (
    <span className={cx("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", style)}>
      {formatStatus(computedStatus ?? statusRaw ?? normalized)}
    </span>
  );
};
