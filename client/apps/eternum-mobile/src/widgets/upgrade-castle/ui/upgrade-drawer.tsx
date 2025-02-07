import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourcesIds, getLevelName, resources } from "@bibliothecadao/eternum";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface UpgradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  castleLevel: number;
  onUpgrade: () => Promise<void>;
}

type UpgradeStep = "cost" | "upgrading" | "success" | "error";

// Mock upgrade cost data - in real app this would come from the backend
const MOCK_UPGRADE_COST = [
  { id: ResourcesIds.Stone, amount: 1000000 },
  { id: ResourcesIds.Wood, amount: 1000000 },
  { id: ResourcesIds.Gold, amount: 1000000 },
  { id: ResourcesIds.Mithral, amount: 1000000 },
];

export const UpgradeDrawer = ({ isOpen, onClose, castleLevel, onUpgrade }: UpgradeDrawerProps) => {
  const [step, setStep] = useState<UpgradeStep>("cost");
  const [error, setError] = useState<string>("");

  // Reset state when drawer is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("cost");
        setError("");
      }, 500);
    }
  }, [isOpen]);

  const handleUpgrade = async () => {
    try {
      setStep("upgrading");
      await onUpgrade();
      setStep("success");
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "cost":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center">Upgrade Castle</DrawerTitle>
              <DrawerDescription className="text-center">Upgrade to {getLevelName(castleLevel)}</DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Required Resources:</h4>
                <div className="space-y-3">
                  {MOCK_UPGRADE_COST.map((resource) => {
                    const resourceData = resources.find((r) => r.id === resource.id);
                    if (!resourceData) return null;

                    return (
                      <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <img src={resourceData.img} alt={resourceData.trait} className="h-8 w-8" />
                          <span className="font-medium">{resourceData.trait}</span>
                        </div>
                        <span className="text-muted-foreground">{resource.amount.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleUpgrade}>
                Confirm Upgrade
              </Button>
            </div>
          </DrawerContent>
        );

      case "upgrading":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center">Upgrading Castle</DrawerTitle>
              <DrawerDescription className="text-center">To {getLevelName(castleLevel)}</DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>

              <Button className="w-full" size="lg" disabled>
                Upgrading...
              </Button>
            </div>
          </DrawerContent>
        );

      case "success":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center text-green-500">Upgrade Successful</DrawerTitle>
              <DrawerDescription className="text-center">
                Your castle is now {getLevelName(castleLevel)}
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <Check className="h-12 w-12 text-green-500" />
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
              <DrawerTitle className="text-3xl font-bokor text-center text-red-500">Upgrade Failed</DrawerTitle>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="flex justify-center">
                <X className="h-12 w-12 text-red-500" />
              </div>

              <div className="text-center">
                <span className="text-red-500">{error}</span>
              </div>

              <Button className="w-full" variant="secondary" size="lg" onClick={() => setStep("cost")}>
                Try again
              </Button>
            </div>
          </DrawerContent>
        );

      default:
        return null;
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      {renderStepContent()}
    </Drawer>
  );
};
