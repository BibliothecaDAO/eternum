import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import type { ResourceArrivalInfo } from "@bibliothecadao/types";
import { formatTime } from "@bibliothecadao/eternum";

export function summarizeIncomingCaravans(arrivals: readonly ResourceArrivalInfo[], structureId: number, now: number) {
  const incoming = arrivals.filter(
    (arrival) => arrival.structureEntityId === structureId && Number(arrival.arrivesAt) > now,
  );
  if (!incoming.length) return null;
  return {
    count: incoming.length,
    nextInSeconds: Math.min(...incoming.map((arrival) => Number(arrival.arrivesAt))) - now,
  };
}

export function IncomingCaravans({ structureId, isOwner }: { structureId: number; isOwner: boolean }) {
  const arrivals = useWorldSlicesStore((state) => state.resourceArrivals);
  const now = useCurrentBlockTimestamp();
  const incoming = isOwner ? summarizeIncomingCaravans(arrivals, structureId, now) : null;
  if (!incoming) return null;
  return (
    <p className="px-3 py-2 text-xs text-gold" aria-label="Incoming caravans">
      Incoming · {incoming.count} {incoming.count === 1 ? "caravan" : "caravans"} · next in{" "}
      {formatTime(incoming.nextInSeconds)}
    </p>
  );
}
