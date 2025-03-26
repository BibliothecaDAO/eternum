import { getBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { configManager, divideByPrecision, getBalance, getLevelName, resources } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface UpgradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: number;
  realmEntityId: number;
  onUpgrade: () => Promise<void>;
}

type UpgradeStep = "cost" | "upgrading" | "success" | "error";

export const UpgradeDrawer = ({ isOpen, onClose, currentLevel, realmEntityId, onUpgrade }: UpgradeDrawerProps) => {
  const [step, setStep] = useState<UpgradeStep>("cost");
  const [error, setError] = useState<string>("");
  const { setup } = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const nextLevel = currentLevel + 1;

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

  const getUpgradeCosts = () => {
    return configManager.realmUpgradeCosts[nextLevel] || [];
  };

  const checkBalance = () => {
    const costs = getUpgradeCosts();
    return costs.every((cost) => {
      const balance = getBalance(realmEntityId, cost.resource, currentDefaultTick, setup.components);
      return divideByPrecision(balance.balance) >= cost.amount;
    });
  };

  const renderStepContent = () => {
    switch (step) {
      case "cost":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center">Upgrade Castle</DrawerTitle>
              <DrawerDescription className="text-center">
                {getLevelName(currentLevel)} → {getLevelName(nextLevel)}
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Required Resources:</h4>
                <div className="space-y-3">
                  {getUpgradeCosts().map((cost) => {
                    const resourceData = resources.find((r) => r.id === cost.resource);
                    if (!resourceData) return null;

                    const balance = getBalance(realmEntityId, cost.resource, currentDefaultTick, setup.components);
                    const currentAmount = divideByPrecision(balance.balance);
                    const hasEnough = currentAmount >= cost.amount;

                    return (
                      <div
                        key={cost.resource}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <ResourceIcon resourceId={cost.resource} size={24} />
                          <span className="font-medium">{resourceData.trait}</span>
                        </div>
                        <div className="text-right">
                          <span className={`${hasEnough ? "text-green-500" : "text-red-500"}`}>
                            {currentAmount.toLocaleString()} /
                          </span>
                          <span className="text-muted-foreground ml-1">{cost.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleUpgrade} disabled={!checkBalance()}>
                {checkBalance() ? `Upgrade to Level ${nextLevel}` : "Insufficient Resources"}
              </Button>
            </div>
          </DrawerContent>
        );

      case "upgrading":
        return (
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-3xl font-bokor text-center">Upgrading Castle</DrawerTitle>
              <DrawerDescription className="text-center">
                {getLevelName(currentLevel)} → {getLevelName(nextLevel)}
              </DrawerDescription>
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
                Your castle is now {getLevelName(nextLevel)}
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
