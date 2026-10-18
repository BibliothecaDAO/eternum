import { useRef, useState } from "react";
import { useConfirmFor } from "@/hooks/helpers/use-confirm-for";
import { validateAndParseAddress } from "starknet";
import { configManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { StructureType } from "@bibliothecadao/types";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { HudButton, HudField } from "@/ui/design-system/kit/hud-elements";
import { toast } from "@/ui/features/event-feed/notify";

function recipientAddress(value: string): string | undefined {
  if (!/^0x[\da-f]+$/i.test(value)) return undefined;
  try {
    const address = validateAndParseAddress(value);
    return BigInt(address) === 0n ? undefined : address;
  } catch {
    return undefined;
  }
}

export const StructureOwnershipTransfer = ({ structureId }: { structureId: number }) => {
  const {
    setup: { store, systemCalls },
    account: { account },
  } = useGame();
  const mode = useResolvedWorldGameMode();
  const key = { game_id: configManager.getActiveGameId(), entity_id: structureId };
  const structure = useNativeRow("Structure", key);
  const { confirming, ask, close } = useConfirmFor(structureId);
  const [recipient, setRecipient] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const actor = account ? BigInt(account.address) : 0n;
  const address = recipientAddress(recipient.trim());
  const validRecipient = address !== undefined && BigInt(address) !== actor;
  const canTransferOwnership =
    mode === "eternum" &&
    actor !== 0n &&
    structure?.owner === actor &&
    structure.base.category !== StructureType.Village;

  if (!canTransferOwnership) return null;

  const transfer = async () => {
    if (!validRecipient || !address || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      const current = store.require("Structure", key);
      if (current.owner !== actor) throw new Error("You no longer own this structure");
      await systemCalls.transfer_structure_ownership({
        signer: account,
        structure_id: structureId,
        new_owner: address,
      });
      close();
      setRecipient("");
    } catch (error) {
      toast.failed(error, "Could not transfer ownership");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 border-t border-hud-divider pt-2">
      {confirming ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-hud-label text-hud-muted">Recipient gameplay account</span>
            <HudField
              aria-label="Recipient gameplay account"
              value={recipient}
              onChange={setRecipient}
              placeholder="0x…"
              spellCheck={false}
              disabled={pending}
            />
          </div>
          <p className="text-hud-label text-hud-muted">
            Transfer this structure and its inventory to this gameplay account. This cannot be undone.
          </p>
          {recipient && !validRecipient && (
            <p role="alert" className="text-hud-label text-hud-bad">
              Enter a valid, nonzero gameplay account other than your own.
            </p>
          )}
          <div className="flex gap-2">
            <HudButton kind="secondary" tone="bad" disabled={!validRecipient || pending} onClick={transfer}>
              Confirm transfer
            </HudButton>
            <HudButton kind="quiet" disabled={pending} onClick={close}>
              Cancel
            </HudButton>
          </div>
        </>
      ) : (
        <HudButton kind="secondary" size="sm" onClick={ask}>
          Transfer ownership
        </HudButton>
      )}
    </div>
  );
};
