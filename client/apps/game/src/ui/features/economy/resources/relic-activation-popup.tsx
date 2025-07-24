import Button from "@/ui/design-system/atoms/button";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
import { getRecipientTypeColor, getRelicTypeColor } from "@/ui/design-system/molecules/relic-colors";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useDojo } from "@bibliothecadao/react";
import { findResourceById, getRelicInfo, ID, RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import React, { useMemo, useState } from "react";

interface RelicActivationPopupProps {
  structureEntityId: ID;
  recipientType: RelicRecipientType;
  relicId: ID;
  relicBalance: number;
  onClose: () => void;
}

export const RelicActivationPopup: React.FC<RelicActivationPopupProps> = ({
  structureEntityId,
  recipientType,
  relicId,
  relicBalance,
  onClose,
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
        entity_id: structureEntityId,
        relic_resource_id: relicId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      console.log("applyRelicCall", applyRelicCall);

      await applyRelicCall;
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
          disabled={isLoading || !!error || !isCompatible}
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
    <BasePopup
      title="Activate Relic"
      onClose={onClose}
      footer={footer}
      contentClassName=""
    >

        <div className="flex flex-col items-center mb-6">
          <ResourceIcon resource={ResourcesIds[relicId]} size="xl" withTooltip={false} />
          <div className="mt-3 text-center">
            <p className="text-lg font-semibold">{resourceName}</p>
            <p className="text-sm text-gold/60">Available: {relicBalance}</p>
          </div>
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

        {!isCompatible ? (
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
        ) : (
          <div className="w-full p-3 bg-red-900/20 border border-red-600/30 rounded mb-4">
            <p className="text-xs text-red-400 font-semibold text-center">
              ⚠️ Warning: Relic activation is permanent and cannot be undone!
            </p>
          </div>
        )}

    </BasePopup>
  );
};
