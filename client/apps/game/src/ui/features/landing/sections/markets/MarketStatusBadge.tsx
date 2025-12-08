import type { Market } from "@pm/sdk";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

const STATUS_STYLES: Record<string, string> = {
  open: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  trading: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  closed: "border-orange-400/40 bg-orange-400/10 text-orange-100",
  resolvable: "border-orange-400/40 bg-orange-400/10 text-orange-100",
  resolved: "border-blue-400/40 bg-blue-400/10 text-blue-100",
  settling: "border-blue-400/40 bg-blue-400/10 text-blue-100",
  pending: "border-white/30 bg-white/5 text-white/80",
  upcoming: "border-white/30 bg-white/5 text-white/80",
  cancelled: "border-red-400/40 bg-red-400/10 text-red-100",
  default: "border-white/30 bg-white/5 text-white/80",
};

const formatStatus = (status?: unknown) => {
  if (typeof status !== "string") return "Unknown";
  if (!status) return "Unknown";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const MarketStatusBadge = ({ market }: { market: Market }) => {
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
    <span
      className={cx(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
        style,
      )}
    >
      {formatStatus(computedStatus ?? statusRaw ?? normalized)}
    </span>
  );
};
