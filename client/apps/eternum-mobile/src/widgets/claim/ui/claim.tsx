import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { divideByPrecision, formatTime } from "@bibliothecadao/eternum";
import { ResourceArrivalInfo, ResourcesIds } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

interface ClaimProps {
  arrival: ResourceArrivalInfo;
  onClaim: (arrival: ResourceArrivalInfo) => Promise<void>;
  isReady: boolean;
}

export function Claim({ arrival, onClaim, isReady }: ClaimProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { currentBlockTimestamp } = getBlockTimestamp();
  const [now, setNow] = useState(currentBlockTimestamp);

  useEffect(() => {
    if (!currentBlockTimestamp) return;
    setNow(currentBlockTimestamp);

    const interval = setInterval(() => {
      setNow((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentBlockTimestamp]);

  const handleClaim = async () => {
    try {
      setIsLoading(true);
      await onClaim(arrival);
    } catch (error) {
      console.error("Failed to claim resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const arrivalTime = new Date(Number(arrival.arrivesAt) * 1000)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");

  const renderStatus = useMemo(() => {
    if (!now) return null;

    return isReady ? (
      <div className="flex items-center gap-2 bg-emerald-900/40 text-emerald-400 rounded-md px-3 py-1.5 text-sm font-medium border border-emerald-700/50">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
        <span>Ready to claim</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 bg-amber-900/40 text-amber-400 rounded-md px-3 py-1.5 text-sm font-medium border border-amber-700/50">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
        <span>Arriving in {formatTime(Number(arrival.arrivesAt) - now)}</span>
      </div>
    );
  }, [now, isReady, arrival.arrivesAt]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg flex items-center gap-2">
          <ResourceIcon resourceId={ResourcesIds.Donkey} size={24} />
          <span className="font-bokor">{isReady ? "Donkeys arrived!" : "Donkeys en route"}</span>
          <span className="text-muted-foreground text-xs">{arrivalTime}</span>
        </h3>
        {renderStatus}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {arrival.resources.map((resource) => (
          <ResourceAmount
            key={resource.resourceId}
            resourceId={resource.resourceId}
            amount={divideByPrecision(resource.amount)}
            size="md"
            showName={true}
            direction="horizontal"
          />
        ))}
      </div>

      <Button
        className="w-full"
        variant={isReady ? "default" : "secondary"}
        onClick={handleClaim}
        disabled={!isReady || isLoading}
      >
        {isLoading ? "Claiming..." : isReady ? "Claim resources" : "Not ready yet"}
      </Button>
    </Card>
  );
}
