import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useDojo } from "@bibliothecadao/react";
import {
  findResourceById,
  getRelicInfo,
  ID,
  RelicActivation,
  RelicRecipientType,
  ResourcesIds,
} from "@bibliothecadao/types";
import { X } from "lucide-react";
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

  const resourceName = useMemo(() => {
    return findResourceById(relicId)?.trait || "Unknown Relic";
  }, [relicId]);

  const isCompatible = useMemo(() => {
    if (!relicInfo) return false;
    return (
      (recipientType === RelicRecipientType.Explorer &&
        (relicInfo.activation === RelicActivation.Army || relicInfo.activation === RelicActivation.ArmyAndStructure)) ||
      (recipientType === RelicRecipientType.Structure &&
        (relicInfo.activation === RelicActivation.Structure ||
          relicInfo.activation === RelicActivation.ArmyAndStructure))
    );
  }, [relicInfo, recipientType]);

  const handleConfirm = async () => {
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
        recipient_type: recipientType,
      });

      await applyRelicCall;
      onClose();
    } catch (err) {
      console.error("Failed to activate relic:", err);
      setError("Failed to activate relic. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-100 inset-0 bg-brown bg-opacity-60 z-50 flex justify-center items-center">
      <div className="border border-gold/10 bg-brown/90 panel-wood rounded p-8 w-full max-w-md mx-auto flex flex-col items-center relative">
        <div className="absolute top-3 right-3">
          <Button className="!p-4" size="xs" variant="default" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <h5 className="text-gold font-bold mb-4">Activate Relic</h5>

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
            <p className="text-xs text-gold/80 mb-2">{relicInfo.effect}</p>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  relicInfo.type === "Stamina"
                    ? "bg-green-600/20 text-green-400"
                    : relicInfo.type === "Damage"
                      ? "bg-red-600/20 text-red-400"
                      : relicInfo.type === "Damage Reduction"
                        ? "bg-blue-600/20 text-blue-400"
                        : relicInfo.type === "Exploration"
                          ? "bg-purple-600/20 text-purple-400"
                          : relicInfo.type === "Production"
                            ? "bg-yellow-600/20 text-yellow-400"
                            : "bg-gray-600/20 text-gray-400"
                }`}
              >
                {relicInfo.type}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  relicInfo.activation === RelicActivation.Army
                    ? "bg-red-600/20 text-red-400"
                    : relicInfo.activation === RelicActivation.Structure
                      ? "bg-green-600/20 text-green-400"
                      : "bg-orange-600/20 text-orange-400"
                }`}
              >
                {relicInfo.activation}
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
              {relicInfo?.activation} relics can only be activated by{" "}
              {relicInfo?.activation === RelicActivation.Army
                ? "explorers"
                : relicInfo?.activation === RelicActivation.Structure
                  ? "structures"
                  : "explorers and structures"}
            </p>
          </div>
        ) : (
          <div className="w-full p-3 bg-red-900/20 border border-red-600/30 rounded mb-4">
            <p className="text-xs text-red-400 font-semibold text-center">
              ⚠️ Warning: Relic activation is permanent and cannot be undone!
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
};
