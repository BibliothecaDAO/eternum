import { Account, RpcError } from "starknet";
import { ledgerChestChanges, type LedgerContract } from "./ledger";
import { relayOperation, type ChestPorts } from "./ports";
import { rpcAt, readConfirmedLedgerHead, decodeChest } from "@realms-world/value-ledger";

interface Connection {
  rpcUrl: string;
  contractAddress: string;
}
interface Signer extends Connection {
  accountAddress: string;
  privateKey: string;
}

export const chestLedgerReads = (connection: Connection & LedgerContract): Omit<ChestPorts, "finish"> => ({
  changes: (fromBlock, cursor, anchor) => ledgerChestChanges(connection.rpcUrl, connection, fromBlock, cursor, anchor),
  head: () =>
    relayOperation("read chest head", async () => {
      return (await readConfirmedLedgerHead(rpcAt(connection.rpcUrl))).number;
    }),
  chest: (tokenId) => relayOperation("read requested chest", () => readChest(connection, tokenId)),
});
/** A finish sent for a chest whose outcome is not known yet: its transaction and when it was sent. */
export interface SubmittedFinish {
  hash: string;
  sentAt: number;
}
/** Where the relay keeps each chest's sent finish until its outcome is known, across requests and restarts. */
export interface SubmittedFinishes {
  submitted(tokenId: string): Promise<SubmittedFinish | undefined>;
  submit(tokenId: string, finish: SubmittedFinish): Promise<void>;
  settle(tokenId: string): Promise<void>;
}

/**
 * A sent finish the node has never heard of after this long was dropped: the chest may be finished again. A minute is
 * far past a Starknet block, and the node answers a hash it accepted from the moment it accepts it.
 */
const DROPPED_AFTER_MS = 60_000;

/**
 * open_finish for a requested chest, sent at most once while its outcome is unknown ("in_flight" until it is known): the sent hash is kept before its
 * receipt is awaited, so a receipt wait that fails leaves it kept, and the next request (the page's or the tick's)
 * reconciles it instead of sending another. Only a finish that reverted, or that the node dropped, frees the chest for
 * a new one. The ledger's "already finished" assertion is the backstop, not the guard.
 */
export const finishChestOnLedger = (signer: Signer, tokenId: string, finishes: SubmittedFinishes) =>
  relayOperation("finish requested chest", async () => {
    const chest = await readChest(signer, tokenId);
    if (chest.finished) {
      await finishes.settle(tokenId);
      return "finished" as const;
    }
    const provider = rpcAt(signer.rpcUrl);
    const previous = await finishes.submitted(tokenId);
    if (previous && (await sentFinishOutcome(provider, previous)) === "in_flight") return "in_flight" as const;
    const account = new Account({ provider, address: signer.accountAddress, signer: signer.privateKey });
    const transaction = await account.execute({
      contractAddress: signer.contractAddress,
      entrypoint: "open_finish",
      calldata: tokenLimbs(tokenId),
    });
    await finishes.submit(tokenId, { hash: transaction.transaction_hash, sentAt: Date.now() });
    const receipt = await provider.waitForTransaction(transaction.transaction_hash);
    await finishes.settle(tokenId);
    if (receipt.isReverted()) throw new Error("chest_finish_reverted");
    return "finished" as const;
  });

/**
 * A kept finish is in flight until the node says it reverted, or has not known it for a minute: a hash the node does not
 * know yet is still an unknown outcome, not a failed one.
 */
const sentFinishOutcome = async (
  provider: ReturnType<typeof rpcAt>,
  finish: SubmittedFinish,
): Promise<"in_flight" | "failed"> => {
  try {
    const status = await provider.getTransactionStatus(finish.hash);
    return status.execution_status === "REVERTED" ? "failed" : "in_flight";
  } catch (error) {
    if (!isUnknownTransaction(error)) throw error;
    return Date.now() - finish.sentAt > DROPPED_AFTER_MS ? "failed" : "in_flight";
  }
};
const isUnknownTransaction = (error: unknown) =>
  error instanceof RpcError ? error.isType("TXN_HASH_NOT_FOUND") : /transaction hash not found/i.test(String(error));
const readChest = async (connection: Connection, tokenId: string) => {
  const fields = await rpcAt(connection.rpcUrl).callContract(
    { contractAddress: connection.contractAddress, entrypoint: "get_chest", calldata: tokenLimbs(tokenId) },
    "latest",
  );
  return decodeChest(fields);
};
const tokenLimbs = (value: string) => {
  const n = BigInt(value);
  if (n < 0n || n >= 2n ** 256n) throw new Error("invalid_chest_id");
  return [String(n & (2n ** 128n - 1n)), String(n >> 128n)];
};
