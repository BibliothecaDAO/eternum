import type { Market } from "@pm/sdk";
import { HStack, VStack } from "@pm/ui";

const formatTimestamp = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const timestampMs = num > 10_000_000_000 ? num : num * 1000;
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

export const MarketTimeline = ({ market }: { market: Market }) => {
  const start =
    formatTimestamp((market as any).start_at ?? (market as any).startAt) ||
    formatTimestamp((market as any).created_at ?? (market as any).createdAt);
  const resolve = formatTimestamp((market as any).resolve_at ?? (market as any).end_at ?? (market as any).endAt);

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
    </VStack>
  );
};
