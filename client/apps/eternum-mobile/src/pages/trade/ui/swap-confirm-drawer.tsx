import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import {
  calculateDonkeysNeeded,
  configManager,
  divideByPrecision,
  getBalance,
  getTotalResourceWeightKg,
} from "@bibliothecadao/eternum";

import {
  Resources,
  ResourcesIds,
} from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sellAmount: number;
  buyAmount: number;
  sellResource: Resources;
  buyResource: Resources;
  onConfirm: () => Promise<void>;
  travelTime?: number; // Travel time in seconds
}

type SwapState = "confirm" | "swapping" | "success" | "error";

export const SwapConfirmDrawer = ({
  isOpen,
  onClose,
  sellAmount,
  buyAmount,
  sellResource,
  buyResource,
  onConfirm,
  travelTime,
}: ConfirmDrawerProps) => {
  const [state, setState] = useState<SwapState>("confirm");
  const [error, setError] = useState<string>("");
  const [canCarry, setCanCarry] = useState(false);

  const { structureEntityId } = useStore();
  const {
    setup: { components },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  // Determine which resources are being transported - mirroring swap.tsx
  const resourcesToTransport = useMemo(() => {
    // In a swap, only one resource is actually transported:
    // - If selling Lords (buying resource), we transport the resource being purchased
    // - If selling resource (buying Lords), we transport Lords (not the resource being sold)
    if (sellResource.id === ResourcesIds.Lords) {
      // Selling Lords to buy another resource - transport the purchased resource
      return [{ resourceId: buyResource.id, amount: buyAmount }];
    } else {
      // Selling resource to buy Lords - transport Lords (not the resource)
      return [{ resourceId: ResourcesIds.Lords, amount: buyAmount }];
    }
  }, [sellResource.id, buyResource.id, buyAmount]);

  // Calculate resource weights from the resources being transported
  const resourceWeightKg = useMemo(() => {
    return getTotalResourceWeightKg(resourcesToTransport);
  }, [resourcesToTransport]);

  // Calculate needed donkeys based on weight
  const neededDonkeys = useMemo(() => calculateDonkeysNeeded(resourceWeightKg), [resourceWeightKg]);

  // Get donkey balance
  const donkeyBalance = useMemo(() => {
    const { balance } = getBalance(structureEntityId, ResourcesIds.Donkey, currentDefaultTick, components);
    return divideByPrecision(balance);
  }, [components, currentDefaultTick, structureEntityId]);

  // Calculate arrival time - mirroring travel-info.tsx approach
  const arrivalTime = useMemo(() => {
    if (travelTime === undefined) return null;

    // Convert travel time from seconds to minutes for calculation
    const travelTimeMinutes = travelTime / 60;

    const currentTimestampMs = getBlockTimestamp().currentBlockTimestamp * 1000;
    const travelTimeMs = travelTimeMinutes * 60 * 1000;
    const arrivalTimeMs = currentTimestampMs + travelTimeMs;

    // Calculate the next hour boundary after arrival
    const arrivalDate = new Date(arrivalTimeMs);
    const nextHourDate = new Date(arrivalDate);
    nextHourDate.setHours(arrivalDate.getHours() + 1, 0, 0, 0);

    return nextHourDate;
  }, [travelTime]);

  // Format arrival time
  const formattedArrivalTime = useMemo(() => {
    if (!arrivalTime) return "";

    const hours = arrivalTime.getHours();
    const minutes = arrivalTime.getMinutes();

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }, [arrivalTime]);

  // Timer effect to update the formatted time
  useEffect(() => {
    if ((state === "swapping" || state === "success") && arrivalTime) {
      const timer = setInterval(() => {
        // Force re-render to update the formatted time
        setState((prevState) => prevState);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [state, arrivalTime]);

  // Check if we have enough donkeys
  useEffect(() => {
    setCanCarry(donkeyBalance >= neededDonkeys);
  }, [donkeyBalance, neededDonkeys]);

  // Reset state when drawer is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setState("confirm");
        setError("");
      }, 500);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      setState("swapping");
      await onConfirm();
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  // Calculate time remaining for display
  const getTimeRemaining = () => {
    if (!arrivalTime) return "";

    const now = Date.now();
    const timeLeft = Math.max(0, arrivalTime.getTime() - now);

    if (timeLeft <= 0) return "Arrived";

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Determine which resource is being transported (for display)
  const transportedResource = useMemo(() => {
    if (sellResource.id === ResourcesIds.Lords) {
      // If selling Lords (buying resource), we're transporting the resource being purchased
      return buyResource.trait;
    } else {
      // If selling resource (buying Lords), we're transporting Lords
      return "Lords";
    }
  }, [sellResource.id, buyResource.trait]);

  const renderContent = () => {
    switch (state) {
      case "confirm":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center">Confirm Swap</DrawerTitle>
              <DrawerDescription>
                <div className="flex items-center justify-center gap-2 text-xl">
                  <span className="text-red-500">-{sellAmount}</span>
                  <ResourceIcon resourceId={sellResource.id} size={24} />
                  <ArrowRight className="text-muted-foreground" />
                  <span className="text-green-500">+{buyAmount}</span>
                  <ResourceIcon resourceId={buyResource.id} size={24} />
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              {!canCarry && (
                <div className="p-2 bg-red-500/20 text-red-500 rounded-md">
                  Not enough donkeys to transport {transportedResource}
                </div>
              )}

              <div className="space-y-2">
                {arrivalTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Arrival</span>
                    <span>{formattedArrivalTime}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Transfer Weight</span>
                  <span>{resourceWeightKg} kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Donkeys Burnt for Transfer</span>
                  <div className="flex items-center gap-1">
                    <span className={neededDonkeys > donkeyBalance ? "text-red-500" : ""}>{neededDonkeys}</span>
                    <ResourceIcon resourceId={ResourcesIds.Donkey} size={20} />
                    <span className="text-sm text-muted-foreground">[{donkeyBalance}]</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <h3 className="font-medium">Resource Weights</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={ResourcesIds.Lords} size={20} />
                    <span>LORDS: {configManager.getResourceWeightKg(ResourcesIds.Lords)} kg/unit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={ResourcesIds.Wheat} size={20} />
                    <span>Food: {configManager.getResourceWeightKg(ResourcesIds.Wheat)} kg/unit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={ResourcesIds.Wood} size={20} />
                    <span>Other: {configManager.getResourceWeightKg(ResourcesIds.Wood)} kg/unit</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Each resource has a different weight per unit.</p>
              </div>

              <Button className="w-full" size="lg" onClick={handleConfirm} disabled={!canCarry}>
                Confirm Swap
              </Button>
            </div>
          </DrawerContent>
        );

      case "swapping":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center">Swapping</DrawerTitle>
              <DrawerDescription>
                <div className="flex items-center justify-center gap-2 text-xl">
                  <span>{sellAmount}</span>
                  <ResourceIcon resourceId={sellResource.id} size={24} />
                  <ArrowRight className="text-muted-foreground" />
                  <span>{buyAmount}</span>
                  <ResourceIcon resourceId={buyResource.id} size={24} />
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>

              <div className="h-px bg-border" />

              <div className="text-center">
                <span className="text-muted-foreground">Time until arrival: {getTimeRemaining()}</span>
              </div>

              <Button className="w-full" size="lg" disabled>
                Waiting confirmation...
              </Button>
            </div>
          </DrawerContent>
        );

      case "success":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center text-green-500">Swap Successful</DrawerTitle>
              <DrawerDescription>
                <div className="flex items-center justify-center gap-2 text-xl">
                  <span className="text-red-500">-{sellAmount}</span>
                  <ResourceIcon resourceId={sellResource.id} size={24} />
                  <ArrowRight className="text-green-500" />
                  <span className="text-green-500">+{buyAmount}</span>
                  <ResourceIcon resourceId={buyResource.id} size={24} />
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <Check className="h-12 w-12 text-green-500" />
              </div>

              <div className="h-px bg-border" />

              <div className="text-center">
                <span className="text-muted-foreground">Time until arrival: {getTimeRemaining()}</span>
              </div>

              <Button className="w-full" size="lg" onClick={onClose}>
                Close
              </Button>
            </div>
          </DrawerContent>
        );

      case "error":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center text-red-500">Swap Failed</DrawerTitle>
              <DrawerDescription>
                <div className="flex items-center justify-center gap-2 text-xl">
                  <span className="line-through">{sellAmount}</span>
                  <ResourceIcon resourceId={sellResource.id} size={24} />
                  <ArrowRight className="text-red-500" />
                  <span className="line-through">{buyAmount}</span>
                  <ResourceIcon resourceId={buyResource.id} size={24} />
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <X className="h-12 w-12 text-red-500" />
              </div>

              <div className="h-px bg-border" />

              <div className="text-center">
                <span className="text-red-500">{error}</span>
              </div>

              <Button className="w-full" variant="secondary" size="lg" onClick={() => setState("confirm")}>
                Try again
              </Button>
            </div>
          </DrawerContent>
        );
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      {renderContent()}
    </Drawer>
  );
};
