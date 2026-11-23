import { Account } from "starknet";
import { rpcAt, readLedgerSlot, readConfirmedLedgerHead, type LedgerSlotKey } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";
import type { LedgerContract } from "./ledger";

interface Credentials extends LedgerContract {
  rpcUrl: string;
  accountAddress: string;
  privateKey: string;
}
/** Recovery may cancel before close or abort after end; return the remaining wait between those boundaries. */
export const refundSlotOnLedger = (credentials: Credentials, key: LedgerSlotKey) =>
  relayOperation("unlock failed Blitz refunds", async (): Promise<number | null> => {
    const provider = rpcAt(credentials.rpcUrl);
    const head = await readConfirmedLedgerHead(provider);
    const slot = await readLedgerSlot(provider, credentials.contractAddress, key, head.number);
    if (!slot.exists || slot.cancelled) return null;
    if (head.time >= slot.close && head.time < slot.end) return slot.end - head.time;
    await submit(credentials, head.time < slot.close ? "cancel_slot" : "abort_slot", [key.chainId, String(key.slotId)]);
    const refunded = await readLedgerSlot(provider, credentials.contractAddress, key, await provider.getBlockNumber());
    if (!refunded.exists || !refunded.cancelled) throw new Error("ledger_refunds_not_enabled");
    return null;
  });

const submit = async (credentials: Credentials, entrypoint: string, calldata: string[]) => {
  const provider = rpcAt(credentials.rpcUrl);
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  const transaction = await account.execute({ contractAddress: credentials.contractAddress, entrypoint, calldata });
  const receipt = await provider.waitForTransaction(transaction.transaction_hash);
  if (receipt.isReverted()) throw new Error("ledger_launch_mutation_reverted");
};
