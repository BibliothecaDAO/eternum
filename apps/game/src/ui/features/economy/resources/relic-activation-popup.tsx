import { HudButton, HudChip, HudNotice, HudRow, HudWindow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { useGame } from "@/hooks/context/game-context";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import React, { useState } from "react";

import { isRelicCompatible, useRelicEssenceStatus, useRelicMetadata } from "../../relics/hooks/use-relic-activation";
import {
  essencePrice,
  HeldRelic,
  RelicEssenceRequirement,
  RelicIncompatibilityNotice,
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
  } = useGame();

  const { relicInfo, resourceId: relicResourceId, essenceCost } = useRelicMetadata(relicId);
  const { essenceBalance, hasEnoughEssence, shortfall } = useRelicEssenceStatus(entityOwnerId, essenceCost);
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
      setError(shortfall);
      return;
    }

    if (!systemCalls.apply_relic) {
      setError("Relic activation is not available yet");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await systemCalls.apply_relic!({
        signer: account,
        entity_id: entityId,
        relic_resource_id: relicId,
        recipient_type: relicInfo.recipientTypeParam,
      });

      onActivated?.();
      onClose();
    } catch (err) {
      console.error("Failed to activate relic:", err);
      setError("Failed to activate relic. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <HudWindow title="Activate Relic" icon="relics" size="task" onClose={onClose}>
      <HudWindowFoot>
        <HudButton kind="quiet" onClick={onClose} disabled={isLoading}>
          Cancel
        </HudButton>
        <HudButton
          kind="primary"
          prices={essencePrice(essenceCost)}
          busy={isLoading ? "Activating…" : undefined}
          disabled={!!error || !compatible || !hasEnoughEssence}
          onClick={handleConfirm}
        >
          Activate Relic
        </HudButton>
      </HudWindowFoot>
      <div className="flex flex-col gap-3">
        <HeldRelic relicId={relicResourceId} held={String(relicBalance)} />
        {relicInfo && (
          <HudRow
            title={relicInfo.name}
            detail={relicInfo.effectLine}
            trail={
              <span className="flex gap-1">
                <HudChip>{relicInfo.recipientType}</HudChip>
                <HudChip>Level {relicInfo.level}</HudChip>
              </span>
            }
          />
        )}
        <RelicEssenceRequirement
          essenceCost={essenceCost}
          essenceBalance={essenceBalance}
          shortfall={shortfall}
          hasEnoughEssence={hasEnoughEssence}
        />
        {!compatible && <RelicIncompatibilityNotice relicInfo={relicInfo} recipientType={recipientType} />}
        {error && <HudNotice tone="bad" line={error} />}
      </div>
    </HudWindow>
  );
};
