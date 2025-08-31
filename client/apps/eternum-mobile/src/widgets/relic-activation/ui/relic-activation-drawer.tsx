import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import {
  findResourceById,
  getRelicInfo,
  ID,
  RELIC_COST_PER_LEVEL,
  RelicRecipientType,
  ResourcesIds,
} from "@bibliothecadao/types";
import React, { useMemo, useState } from "react";

interface RelicActivationDrawerProps {
  entityId: ID;
  entityOwnerId: ID;
  recipientType: RelicRecipientType;
  relicId: ID;
  relicBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RelicActivationDrawer: React.FC<RelicActivationDrawerProps> = ({
  entityId,
  entityOwnerId,
  recipientType,
  relicId,
  relicBalance,
  open,
  onOpenChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    setup: { systemCalls },
    account: { account },
  } = useDojo();

  const relicInfo = useMemo(() => {
    return getRelicInfo(relicId as ResourcesIds);
  }, [relicId]);

  const isCompatible = recipientType === relicInfo?.recipientType;

  const resourceManager = useResourceManager(entityOwnerId);

  const essenceCostPerLevel = RELIC_COST_PER_LEVEL[relicInfo?.level ?? 1];

  const essenceBalance = useMemo(() => {
    return divideByPrecision(Number(resourceManager.balance(ResourcesIds.Essence)));
  }, [resourceManager]);

  const hasEnoughEssence = essenceBalance >= BigInt(essenceCostPerLevel);

  const resourceName = useMemo(() => {
    return findResourceById(relicId)?.trait || "Unknown Relic";
  }, [relicId]);

  const handleConfirm = async () => {
    if (!relicInfo) {
      setError("Relic not found");
      return;
    }

    if (!account) {
      setError("Account not connected");
      return;
    }

    if (!hasEnoughEssence) {
      setError(`Insufficient essence. Need ${essenceCostPerLevel}, have ${essenceBalance}`);
      return;
    }

    if (!systemCalls.apply_relic) {
      setError("Relic activation is not available yet");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const applyRelicCall = systemCalls.apply_relic({
        signer: account,
        entity_id: entityId,
        relic_resource_id: relicId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      await applyRelicCall;
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to activate relic:", err);
      setError("Failed to activate relic. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Activate Relic</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 flex-1 overflow-y-auto space-y-6">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 flex items-center justify-center rounded-xl bg-muted/20 border border-border mb-3">
              <ResourceIcon resourceId={relicId} size={64} showTooltip={false} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">{resourceName}</h3>
              <p className="text-sm text-muted-foreground">Available: {relicBalance}</p>
            </div>
          </div>

          <div className="bg-muted/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Activation Cost:</span>
              <div className="flex items-center gap-2">
                <ResourceIcon resourceId={ResourcesIds.Essence} size={20} showTooltip={false} />
                <span className="text-sm font-semibold">{essenceCostPerLevel.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Balance:</span>
              <div className="flex items-center gap-2">
                <ResourceIcon resourceId={ResourcesIds.Essence} size={20} showTooltip={false} />
                <span className={`text-sm font-semibold ${hasEnoughEssence ? "text-green-400" : "text-red-400"}`}>
                  {essenceBalance.toLocaleString()}
                </span>
              </div>
            </div>
            {!hasEnoughEssence && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-xs text-destructive font-medium text-center">
                  ⚠️ Not enough essence! Need {(essenceCostPerLevel - essenceBalance).toLocaleString()} more
                </p>
              </div>
            )}
          </div>

          {relicInfo && (
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-semibold mb-1">{relicInfo.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {relicInfo.effect}
                  {relicInfo.duration ? ` for ${relicInfo.duration}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">{relicInfo.type}</Badge>
                <Badge variant="secondary">{relicInfo.recipientType}</Badge>
                <Badge variant="outline">Level {relicInfo.level}</Badge>
              </div>
            </div>
          )}

          {!isCompatible && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium text-center mb-2">
                ⚠️ This relic cannot be activated by{" "}
                {recipientType === RelicRecipientType.Explorer ? "explorers" : "structures"}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {relicInfo?.recipientType} relics can only be activated by{" "}
                {relicInfo?.recipientType === RelicRecipientType.Explorer ? "explorers" : "structures"}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive font-medium text-center">{error}</p>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button
            disabled={isLoading || !!error || !isCompatible || !hasEnoughEssence}
            onClick={handleConfirm}
            className="flex-1"
          >
            {isLoading ? "Activating..." : "Activate Relic"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
