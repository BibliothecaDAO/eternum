import { useResourceArrivals } from "@/features/resource-arrivals";
import { useStore } from "@/shared/store";
import { Claim } from "@/widgets/claim/ui/claim";

export function ClaimTab() {
  const structureEntityId = useStore((state) => state.structureEntityId);
  const { arrivals, claimResources, isReady } = useResourceArrivals(structureEntityId);

  if (!arrivals || arrivals.length === 0) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">No resources to claim</div>;
  }

  return (
    <div className="space-y-4">
      {arrivals.map((arrival) => (
        <Claim
          key={`${arrival.structureEntityId}-${arrival.day}-${arrival.slot}`}
          arrival={arrival}
          onClaim={claimResources}
          isReady={isReady(arrival)}
        />
      ))}
    </div>
  );
}
