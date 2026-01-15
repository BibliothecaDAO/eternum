import Button from "@/ui/design-system/atoms/button";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
import { getRecipientTypeColor, getRelicTypeColor } from "@/ui/design-system/molecules/relic-colors";
import { useDojo } from "@bibliothecadao/react";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import React, { useState } from "react";

import { isRelicCompatible, useRelicEssenceStatus, useRelicMetadata } from "../../relics/hooks/use-relic-activation";
import {
  RelicEssenceRequirement,
  RelicIncompatibilityNotice,
  RelicSummary,
} from "../../relics/components/relic-activation-shared";

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

  const { relicInfo, resourceName, resourceKey, essenceCost } = useRelicMetadata(relicId);
  const { essenceBalance, hasEnoughEssence, missingEssence } = useRelicEssenceStatus(entityOwnerId, essenceCost);
  const compatible = isRelicCompatible(relicInfo, recipientType);

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
      setError(`Insufficient essence. Need ${essenceCost}, have ${essenceBalance}`);
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
          disabled={isLoading || !!error || !compatible || !hasEnoughEssence}
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
      <RelicSummary
        resourceKey={resourceKey}
        title={resourceName}
        subtitle={`Available: ${relicBalance}`}
        layout="vertical"
        iconSize="xl"
        className="mb-6"
      />

      <RelicEssenceRequirement
        className="mb-4"
        essenceCost={essenceCost}
        essenceBalance={essenceBalance}
        missingEssence={missingEssence}
        hasEnoughEssence={hasEnoughEssence}
        balanceLabel="Your Balance"
      />

      {relicInfo && (
        <div className="w-full mb-6 rounded bg-dark-brown/50 p-4">
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

      {!compatible && (
        <RelicIncompatibilityNotice relicInfo={relicInfo} recipientType={recipientType} className="mb-4" />
      )}
    </BasePopup>
  );
};
