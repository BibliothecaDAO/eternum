import { formatCount, formatWait } from "@bibliothecadao/types";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useFactView } from "@/hooks/use-fact-view";
import { resourceArrivalsView } from "@/sync/fact-views";
import type { ResourceArrivalInfo } from "@bibliothecadao/types";

function summarizeIncomingCaravans(arrivals: readonly ResourceArrivalInfo[], structureId: number, now: number) {
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
  const arrivals = useFactView(resourceArrivalsView);
  const now = useCurrentBlockTimestamp();
  const incoming = isOwner ? summarizeIncomingCaravans(arrivals, structureId, now) : null;
  if (!incoming) return null;
  return (
    <p className="px-3 py-2 text-hud-label text-hud-ink" aria-label="Incoming caravans">
      Incoming · {formatCount(incoming.count, "caravan")} · next in {formatWait(incoming.nextInSeconds)}
    </p>
  );
}
