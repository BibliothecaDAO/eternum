import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Resources } from "@bibliothecadao/eternum";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sellAmount: number;
  buyAmount: number;
  sellResource: Resources;
  buyResource: Resources;
  onConfirm: () => Promise<void>;
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
}: ConfirmDrawerProps) => {
  const [state, setState] = useState<SwapState>("confirm");
  const [error, setError] = useState<string>("");
  // @ts-ignore
  const [timeLeft, setTimeLeft] = useState("0 hrs 10 mins");

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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Travel Time</span>
                  <span>0 hrs 10 mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Transfer Weight</span>
                  <span>2 kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Donkeys Burnt for Transfer</span>
                  <div className="flex items-center gap-1">
                    <span>1</span>
                    <ResourceIcon resourceId={25} size={20} />
                    <span className="text-sm text-muted-foreground">[1000600]</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <h3 className="font-medium">Resource Weights</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={31} size={20} />
                    <span>LORDS: 0 kg/unit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={29} size={20} />
                    <span>Food: 0.1 kg/unit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={1} size={20} />
                    <span>Other: 1 kg/unit</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Each resource has a different weight per unit.</p>
              </div>

              <Button className="w-full" size="lg" onClick={handleConfirm}>
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
                <span className="text-muted-foreground">Travel time left: {timeLeft}</span>
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
                <span className="text-muted-foreground">Travel time left: {timeLeft}</span>
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
