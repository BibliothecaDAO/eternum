import { useStructureUpgrade } from "@/features/upgrade-structure";
import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { divideByPrecision, getBalance } from "@bibliothecadao/eternum";
import { LEVEL_DESCRIPTIONS, resources } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface UpgradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  realmEntityId: number;
}

type UpgradeStep = "cost" | "upgrading" | "success" | "error";

export const UpgradeDrawer = ({ isOpen, onClose, realmEntityId }: UpgradeDrawerProps) => {
  const [step, setStep] = useState<UpgradeStep>("cost");
  const [error, setError] = useState<string>("");
  const { setup } = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const { upgradeCosts, nextLevel, nextLevelName, currentLevelName, canUpgrade, handleUpgrade } =
    useStructureUpgrade(realmEntityId);

  // Reset state when drawer is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("cost");
        setError("");
      }, 500);
    }
  }, [isOpen]);

  const onUpgradeClick = async () => {
    try {
      setStep("upgrading");
      await handleUpgrade();
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
              <DrawerDescription className="text-center">
                {currentLevelName} → {nextLevelName}
              </DrawerDescription>
              <p className="text-sm text-center text-muted-foreground mt-2">
                {LEVEL_DESCRIPTIONS[nextLevel as keyof typeof LEVEL_DESCRIPTIONS]}
              </p>
            </DrawerHeader>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-medium">Required Resources:</h4>
                <div className="space-y-3">
                  {upgradeCosts.map((cost) => {
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

              <Button className="w-full" size="lg" onClick={onUpgradeClick} disabled={!canUpgrade}>
                {canUpgrade ? `Upgrade to Level ${nextLevel}` : "Insufficient Resources"}
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
                {currentLevelName} → {nextLevelName}
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
              <DrawerDescription className="text-center">Your castle is now {nextLevelName}</DrawerDescription>
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
