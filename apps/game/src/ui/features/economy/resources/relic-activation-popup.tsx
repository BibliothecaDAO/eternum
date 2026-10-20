import { HudButton, HudChip, HudNotice, HudRow, HudWindow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { useGame } from "@/hooks/context/game-context";
import { ActionFailureNotice } from "@/ui/features/event-feed/action-failure-notice";
import { type ActionFailure, actionFailure } from "@/ui/features/event-feed/notify";
import { useActNowRefusal } from "@/utils/can-issue-orders";
import { ID, RelicRecipientType } from "@bibliothecadao/types";
import React, { useState } from "react";
import { activateRelic, relicShortName } from "@/ui/design-system/kit/words";

import { isRelicCompatible, useRelicEssenceStatus, useRelicMetadata } from "../../relics/hooks/use-relic-activation";
import {
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
  // Why the last press did not activate: told until the next press, which tries again.
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const failed = (reason: string) => setFailure({ refused: false, reason });

  const {
    setup: { systemCalls },
    account: { account },
  } = useGame();

  const { relicInfo, resourceId: relicResourceId, essenceCost } = useRelicMetadata(relicId);
  const { essenceBalance, hasEnoughEssence, shortfall } = useRelicEssenceStatus(entityOwnerId, essenceCost);
  const compatible = isRelicCompatible(relicInfo, recipientType);
  // Why the game takes no action yet ("Starts in 2m 33s"): Activate says so before the click, and stays shut.
  const refusal = useActNowRefusal();

  const handleConfirm = async () => {
    if (!relicInfo) {
      failed("Relic not found");
      return;
    }

    if (!account) {
      failed("Account not connected");
      return;
    }

    if (!hasEnoughEssence) {
      failed(shortfall);
      return;
    }

    if (!systemCalls.apply_relic) {
      failed("Relic activation is not available yet");
      return;
    }

    setIsLoading(true);
    setFailure(null);

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
      setFailure(actionFailure(err, "Failed to activate relic. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <HudWindow title={activateRelic(relicResourceId)} icon="relics" size="task" onClose={onClose}>
      <HudWindowFoot>
        <HudButton kind="quiet" onClick={onClose} disabled={isLoading}>
          Cancel
        </HudButton>
        <HudButton
          kind="primary"
          busy={isLoading ? "Activating…" : undefined}
          disabled={refusal !== null || !compatible || !hasEnoughEssence}
          onClick={handleConfirm}
        >
          Activate Relic
        </HudButton>
      </HudWindowFoot>
      <div className="flex flex-col gap-3">
        <HeldRelic relicId={relicResourceId} held={String(relicBalance)} />
        {relicInfo && (
          <HudRow
            title={relicShortName(relicResourceId)}
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
        {refusal !== null && <HudNotice line={refusal} />}
        {failure && <ActionFailureNotice failure={failure} />}
      </div>
    </HudWindow>
  );
};
