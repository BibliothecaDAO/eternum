import { useRef, useState } from "react";
import { validateAndParseAddress } from "starknet";
import { configManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRow } from "@bibliothecadao/react";
import { StructureType } from "@bibliothecadao/types";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import Button from "@/ui/design-system/atoms/button";
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
  const [confirming, setConfirming] = useState(false);
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
      setConfirming(false);
      setRecipient("");
      toast.success("Structure ownership transferred");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transfer ownership");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 border-t border-gold/20 pt-2">
      {confirming ? (
        <>
          <label className="block text-xs">
            Recipient gameplay account
            <input
              className="mt-1 w-full rounded border border-gold/30 bg-black/25 p-2"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="0x…"
              spellCheck={false}
              disabled={pending}
            />
          </label>
          <p className="text-xs">
            Transfer this structure and its inventory to this gameplay account. This cannot be undone.
          </p>
          {recipient && !validRecipient && (
            <p role="alert" className="text-xs text-red-300">
              Enter a valid, nonzero gameplay account other than your own.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="danger" disabled={!validRecipient || pending} onClick={transfer}>
              Confirm transfer
            </Button>
            <Button disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Transfer ownership
        </Button>
      )}
    </div>
  );
};
