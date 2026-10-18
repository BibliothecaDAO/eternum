import { useRef, useState } from "react";
import { useConfirmFor } from "@/hooks/helpers/use-confirm-for";
import { configManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { DISPLAYED_SLOT_NUMBER_MAP, type GuardSlot } from "@bibliothecadao/types";
import Button from "@/ui/design-system/atoms/button";
import { toast } from "@/ui/features/event-feed/notify";

export const GuardDismissal = ({
  structureId,
  slot,
  disabled,
  onDismissed,
}: {
  structureId: number;
  slot: number;
  disabled: boolean;
  onDismissed: () => void;
}) => {
  const {
    setup: { systemCalls },
    account: { account },
  } = useGame();
  const game_id = configManager.getActiveGameId();
  const structure = useNativeRow("Structure", { game_id, entity_id: structureId });
  const guard = useNativeRow("Guard", { game_id, structure_id: structureId, slot });
  const { confirming, ask, close } = useConfirmFor(`${structureId}:${slot}`);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const canDismiss =
    account &&
    BigInt(account.address) !== 0n &&
    structure?.owner === BigInt(account.address) &&
    slot < structure.base.troop_max_guard_count &&
    guard &&
    guard.troops.count > 0n;

  if (!canDismiss) return null;

  const dismiss = async () => {
    if (disabled || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      await systemCalls.guard_delete({ signer: account, for_structure_id: structureId, slot });
      onDismissed();
    } catch (error) {
      toast.failed(error, "Could not dismiss guard");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-hud-line pt-2">
      {confirming ? (
        <>
          <p className="text-hud-label">
            Dismiss guard in slot {DISPLAYED_SLOT_NUMBER_MAP[slot as GuardSlot]}? All its troops are permanently lost.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" disabled={disabled || pending} onClick={dismiss}>
              Confirm dismissal
            </Button>
            <Button disabled={pending} onClick={close}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" disabled={disabled} onClick={ask}>
          Dismiss guard
        </Button>
      )}
    </div>
  );
};
