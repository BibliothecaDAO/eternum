import { useState } from "react";
import { useGame } from "@/hooks/context/game-context";
import { IDENTITY_POPOVER_ID, useIdentitySession } from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import Button from "@/ui/design-system/atoms/button";
import { toast } from "@/ui/features/event-feed/notify";

function amountInUnits(value: string, decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 77) throw new Error("Unsupported token precision");
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error("Enter a positive amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimal places`);
  const result = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (result <= 0n) throw new Error("Enter a positive amount");
  return result;
}

export function NativeBridgePanel({ structureId }: { structureId: number }) {
  const {
    setup: { store, systemCalls, network },
    account: { account },
  } = useGame();
  const mode = useResolvedWorldGameMode();
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["ResourceToken", "Structure"]);
  const gameId = configManager.getActiveGameId();
  const structure = store.get("Structure", { game_id: gameId, entity_id: structureId });
  const tokens = [...store.rows("ResourceToken")].filter((row) => row.game_id === gameId);
  const [resource, setResource] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [pending, setPending] = useState(false);
  // Value leaves the game only to a wallet the player linked to their Realms account.
  const linkedWallet = useIdentitySession().session?.user.address ?? null;
  if (mode !== "eternum" || !ordersAllowed || !structure || structure.owner !== BigInt(account.address)) return null;
  const token = tokens.find((row) => row.resource_type === Number(resource));
  const bridge = async (deposit: boolean) => {
    const withdrawTo = recipient || linkedWallet;
    if (!token || (!deposit && !withdrawTo)) return;
    setPending(true);
    try {
      const [precision] = deposit
        ? await network.provider.provider.callContract({
            contractAddress: `0x${token.token.toString(16)}`,
            entrypoint: "decimals",
          })
        : ["9"];
      const resources = [
        {
          resource_type: token.resource_type,
          tokenAddress: token.token,
          amount: amountInUnits(amount, deposit ? Number(precision) : 9),
        },
      ];
      if (deposit)
        await systemCalls.bridge_deposit_into_realm({
          signer: account,
          recipient_structure_id: structureId,
          client_fee_recipient: 0,
          resources,
        });
      else
        await systemCalls.bridge_withdraw_from_realm({
          signer: account,
          from_structure_id: structureId,
          recipient_address: withdrawTo ?? "",
          client_fee_recipient: 0,
          resources,
        });
      setAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bridge action failed");
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="space-y-2 text-xs">
      <h4>Resource bridge</h4>
      <select aria-label="Bridge resource" value={resource} onChange={(event) => setResource(event.target.value)}>
        <option value="">Choose resource</option>
        {tokens.map((row) => (
          <option key={row.resource_type} value={row.resource_type}>
            {ResourcesIds[row.resource_type]}
          </option>
        ))}
      </select>
      <input
        aria-label="Bridge amount"
        placeholder="Amount"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <input
        aria-label="Withdrawal recipient"
        placeholder="Recipient (your linked wallet by default)"
        value={recipient}
        onChange={(event) => setRecipient(event.target.value)}
      />
      <p className="text-gold/60">The game’s bridge retention and fees apply to deposits and withdrawals.</p>
      <div className="flex gap-2">
        <Button disabled={!token || pending} isLoading={pending} onClick={() => void bridge(true)}>
          Deposit
        </Button>
        {linkedWallet ? (
          <Button disabled={!token || pending} onClick={() => void bridge(false)}>
            Withdraw
          </Button>
        ) : (
          <Button onClick={() => usePopoverStore.getState().open(IDENTITY_POPOVER_ID)}>
            Link a wallet to withdraw
          </Button>
        )}
      </div>
    </section>
  );
}
