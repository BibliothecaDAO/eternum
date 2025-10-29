import Button from "@/ui/design-system/atoms/button";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
import { getRecipientTypeColor, getRelicTypeColor } from "@/ui/design-system/molecules/relic-colors";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
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

interface RelicActivationPopupProps {
  entityId: ID;
  entityOwnerId: ID;
  recipientType: RelicRecipientType;
  relicId: ID;
  relicBalance: number;
  onClose: () => void;
  onActivated?: () => void;
}

export const RelicActivationPopup: React.FC<RelicActivationPopupProps> = ({
  entityId,
  entityOwnerId,
  recipientType,
  relicId,
  relicBalance,
  onClose,
  onActivated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    setup: { systemCalls },
    account: { account },
  } = useDojo();

  const removeRelicFromStore = useUIStore((state) => state.removeRelicFromEntity);
  const triggerRelicsRefresh = useUIStore((state) => state.triggerRelicsRefresh);

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

    // Check if apply_relic system call exists
    if (!systemCalls.apply_relic) {
      setError("Relic activation is not available yet");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use type assertion to bypass TypeScript checking until proper types are available
      // recipient_type: 0 = Explorer, 1 = Structure (based on RelicRecipientTypeParam enum)
      const applyRelicCall = systemCalls.apply_relic({
        signer: account,
        entity_id: entityId,
        relic_resource_id: relicId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      await applyRelicCall;

      if (account?.address && account.address !== "0x0") {
        removeRelicFromStore({ entityId, resourceId: relicId, recipientType });
        triggerRelicsRefresh();
      }

      onActivated?.();
      onClose();
    } catch (err) {
      console.error("Failed to activate relic:", err);
      setError("Failed to activate relic. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <>
      <div className="flex justify-center space-x-4">
        <Button variant="default" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          disabled={isLoading || !!error || !isCompatible || !hasEnoughEssence}
          isLoading={isLoading}
          variant="gold"
          onClick={handleConfirm}
        >
          Activate Relic
        </Button>
      </div>
      {error && <div className="px-3 mt-4 text-danger font-bold text-center">{error}</div>}
    </>
  );

  return (
    <BasePopup title="Activate Relic" onClose={onClose} footer={footer} contentClassName="">
      <div className="flex flex-col items-center mb-6">
        <ResourceIcon resource={ResourcesIds[relicId]} size="xl" withTooltip={false} />
        <div className="mt-3 text-center">
          <p className="text-lg font-semibold">{resourceName}</p>
          <p className="text-sm text-gold/60">Available: {relicBalance}</p>
        </div>
      </div>

      {/* Essence Cost Section */}
      <div className="w-full mb-4 p-4 bg-dark-brown/30 rounded border border-gold/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gold/80">Activation Cost:</span>
          <div className="flex items-center gap-2">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Essence]} size="sm" withTooltip={false} />
            <span className="text-sm font-bold">{essenceCostPerLevel.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gold/80">Your Balance:</span>
          <div className="flex items-center gap-2">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Essence]} size="sm" withTooltip={false} />
            <span className={`text-sm font-bold ${hasEnoughEssence ? "text-green-400" : "text-red-400"}`}>
              {essenceBalance.toLocaleString()}
            </span>
          </div>
        </div>
        {!hasEnoughEssence && (
          <div className="mt-2 p-2 bg-red-900/30 border border-red-600/40 rounded">
            <p className="text-xs text-red-400 text-center font-semibold">
              ⚠️ Not enough essence! Need {(essenceCostPerLevel - essenceBalance).toLocaleString()} more
            </p>
          </div>
        )}
      </div>

      {relicInfo && (
        <div className="w-full mb-6 p-4 bg-dark-brown/50 rounded">
          <p className="text-sm font-semibold mb-2">{relicInfo.name}</p>
          <p className="text-xs text-gold/80 mb-2">
            {relicInfo.effect}
            {relicInfo.duration ? ` for ${relicInfo.duration}` : ""}
          </p>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getRelicTypeColor(relicInfo.type)}`}>
              {relicInfo.type}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs font-semibold ${getRecipientTypeColor(relicInfo.recipientType)}`}
            >
              {relicInfo.recipientType}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs font-bold ${
                relicInfo.level === 2 ? "bg-purple-600/20 text-purple-400" : "bg-blue-600/20 text-blue-400"
              }`}
            >
              Level {relicInfo.level}
            </span>
          </div>
        </div>
      )}

      {!isCompatible && (
        <div className="w-full p-3 bg-red-900/20 border border-red-600/30 rounded mb-4">
          <p className="text-xs text-red-400 font-semibold text-center">
            ⚠️ This relic cannot be activated by{" "}
            {recipientType === RelicRecipientType.Explorer ? "explorers" : "structures"}
          </p>
          <p className="text-xs text-red-300 text-center mt-1">
            {relicInfo?.recipientType} relics can only be activated by{" "}
            {relicInfo?.recipientType === RelicRecipientType.Explorer ? "explorers" : "structures"}
          </p>
        </div>
      )}
    </BasePopup>
  );
};
