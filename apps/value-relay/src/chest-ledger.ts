import { Account, num, RpcError } from "starknet";
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
/** A finish sent for a chest whose outcome is not known yet: its transaction, and the relay account's nonce it used. */
export interface SubmittedFinish {
  hash: string;
  nonce: string;
}
/** Where the relay keeps each chest's sent finish until its outcome is known, across requests and restarts. */
export interface SubmittedFinishes {
  submitted(tokenId: string): Promise<SubmittedFinish | undefined>;
  submit(tokenId: string, finish: SubmittedFinish): Promise<void>;
  settle(tokenId: string): Promise<void>;
}

/**
 * open_finish for a requested chest, sent at most once while its outcome is unknown ("in_flight" until it is known).
 * The chest is named by its canonical decimal id, so every spelling of one token meets the same record. The sent hash
 * and nonce are kept before the receipt is awaited, so a receipt wait that fails leaves them kept, and the next request
 * (the page's or the tick's) reconciles them instead of sending another. Only an outcome frees the chest for a new
 * finish: the kept one reverted, or it can never land. The ledger's "already finished" assertion is the backstop, not
 * the guard.
 */
export const finishChestOnLedger = (signer: Signer, tokenId: string, finishes: SubmittedFinishes) =>
  relayOperation("finish requested chest", async () => {
    const id = canonicalTokenId(tokenId);
    const chest = await readChest(signer, id);
    if (chest.finished) {
      await finishes.settle(id);
      return "finished" as const;
    }
    const provider = rpcAt(signer.rpcUrl);
    const previous = await finishes.submitted(id);
    if (previous && (await sentFinishOutcome(provider, signer.accountAddress, previous)) === "in_flight")
      return "in_flight" as const;
    const account = new Account({ provider, address: signer.accountAddress, signer: signer.privateKey });
    const nonce = num.toHex(await account.getNonce());
    const transaction = await account.execute(
      { contractAddress: signer.contractAddress, entrypoint: "open_finish", calldata: tokenLimbs(id) },
      { nonce },
    );
    await finishes.submit(id, { hash: transaction.transaction_hash, nonce });
    const receipt = await provider.waitForTransaction(transaction.transaction_hash);
    await finishes.settle(id);
    if (receipt.isReverted()) throw new Error("chest_finish_reverted");
    return "finished" as const;
  });

/**
 * A kept finish has an outcome only when the node says it reverted, or when it can never land: the node does not know
 * its hash and the relay account's nonce it used is already spent in an accepted block. Anything else, a hash the node
 * holds or does not know yet, however long ago it was sent, is still in flight.
 */
const sentFinishOutcome = async (
  provider: ReturnType<typeof rpcAt>,
  accountAddress: string,
  finish: SubmittedFinish,
): Promise<"in_flight" | "failed"> => {
  try {
    const status = await provider.getTransactionStatus(finish.hash);
    return status.execution_status === "REVERTED" ? "failed" : "in_flight";
  } catch (error) {
    if (!isUnknownTransaction(error)) throw error;
    const spent = BigInt(await provider.getNonceForAddress(accountAddress, "latest"));
    return spent > BigInt(finish.nonce) ? "failed" : "in_flight";
  }
};
const isUnknownTransaction = (error: unknown) =>
  error instanceof RpcError ? error.isType("TXN_HASH_NOT_FOUND") : /transaction hash not found/i.test(String(error));
/** One token, one name: the decimal a chest's record is kept under, whatever spelling asked for it. */
const canonicalTokenId = (value: string) => {
  const n = BigInt(value);
  if (n < 0n || n >= 2n ** 256n) throw new Error("invalid_chest_id");
  return n.toString();
};
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
