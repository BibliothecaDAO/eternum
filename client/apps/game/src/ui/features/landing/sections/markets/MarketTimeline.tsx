import type { Market } from "@pm/sdk";
import { HStack, VStack } from "@pm/ui";
import { Flag, Snail } from "lucide-react";

const toDate = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const timestampMs = num > 10_000_000_000 ? num : num * 1000;
  const date = new Date(timestampMs);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const formatTimestamp = (value: unknown) => {
  const date = toDate(value);
  return date ? date.toLocaleString() : null;
};

export const MarketTimeline = ({ market }: { market: Market }) => {
  const createdAt = toDate((market as any).created_at ?? (market as any).createdAt);
  const startAt = toDate((market as any).start_at ?? (market as any).startAt ?? createdAt);
  const endAt = toDate((market as any).end_at ?? (market as any).endAt ?? (market as any).resolve_at);
  const resolveAt = toDate((market as any).resolve_at ?? (market as any).end_at ?? (market as any).endAt);
  const resolvedAt = toDate((market as any).resolved_at ?? (market as any).resolvedAt);

  // Fall back to simple text when critical dates are missing.
  if (!createdAt || !startAt || !endAt || !resolveAt) {
    const start =
      formatTimestamp((market as any).start_at ?? (market as any).startAt) ||
      formatTimestamp((market as any).created_at ?? (market as any).createdAt);
    const resolve = formatTimestamp((market as any).resolve_at ?? (market as any).end_at ?? (market as any).endAt);
    const resolved = formatTimestamp((market as any).resolved_at ?? (market as any).resolvedAt);

    return (
      <VStack className="gap-1 text-xs text-gold/70">
        <HStack className="justify-between">
          <span>Starts</span>
          <span className="text-white/80">{start ?? "TBD"}</span>
        </HStack>
        <HStack className="justify-between">
          <span>Resolves</span>
          <span className="text-white/80">{resolve ?? "TBD"}</span>
        </HStack>
        {resolved ? (
          <HStack className="justify-between">
            <span>Resolved</span>
            <span className="text-white/80">{resolved}</span>
          </HStack>
        ) : null}
      </VStack>
    );
  }

  const nowDate = new Date();
  if (resolveAt && nowDate >= resolveAt) return null;

  const rangeEnd = resolvedAt ?? resolveAt;
  const rangeMs = rangeEnd.getTime() - createdAt.getTime();
  if (rangeMs <= 0) return null;

  const position = (date: Date) =>
    clamp(Math.ceil(((date.getTime() - createdAt.getTime()) * 94) / rangeMs + 2), 0, 100);

  const start = position(startAt);
  const end = position(endAt);
  const resolve = position(resolveAt);
  const resolved = resolvedAt ? position(resolvedAt) : null;
  const now = clamp(Math.ceil(((nowDate.getTime() - createdAt.getTime()) * 94) / rangeMs + 2), 0, 100);

  const startLabel = startAt.toLocaleString();
  const endLabel = endAt.toLocaleString();
  const resolveLabel = resolveAt.toLocaleString();
  const resolvedLabel = resolvedAt?.toLocaleString();

  return (
    <VStack className="text-xs text-gold/70">
      <div className="relative my-3 h-[36px] w-full overflow-hidden">
        <div className="absolute top-[15px] h-[5px] w-full bg-white/10" />
        <div className="absolute top-[15px] h-[5px] bg-gold/40" style={{ width: `${now}%` }} />

        <div className="absolute top-[0px] ml-[-5px]" style={{ left: `${start}%` }} title={`Start ${startLabel}`}>
          <Flag className="h-[16px] w-[16px]" />
        </div>

        <div className="absolute top-[0px] ml-[-5px]" style={{ left: `${end}%` }} title={`End ${endLabel}`}>
          <Flag className="h-[16px] w-[16px] text-danger" />
        </div>

        <div className="absolute top-[0px] ml-[-5px]" style={{ left: `${now}%` }} title="Now">
          <Snail className="h-[16px] w-[16px] text-gold" />
        </div>

        <div
          className="absolute top-[0px] ml-[-5px]"
          style={{ left: `${resolve}%` }}
          title={`Resolvable ${resolveLabel}`}
        >
          <Flag className="h-[16px] w-[16px] text-progress-bar-good" />
        </div>

        {resolvedLabel ? (
          <div
            className="absolute top-[0px] ml-[-5px] rounded-full"
            style={{ left: `${resolved}%` }}
            title={`Resolved ${resolvedLabel}`}
          >
            <Flag className="h-[16px] w-[16px] text-dark-green" />
          </div>
        ) : null}
      </div>

      <HStack className="justify-between text-[11px] text-white/80">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
        <span>{resolveLabel}</span>
      </HStack>
    </VStack>
  );
};
