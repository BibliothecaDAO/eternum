import { Account } from "starknet";
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
/**
 * open_finish for a requested chest. The page's ask and the minute tick may both send one; the ledger finishes a chest
 * once and refuses the other ("Ledger: chest already finished"), which costs a fee and delivers nothing twice. So a send
 * that fails while the chest now reads finished has done its job: the chest is finished.
 */
export const finishChestOnLedger = (signer: Signer, tokenId: string) =>
  relayOperation("finish requested chest", async () => {
    if ((await readChest(signer, tokenId)).finished) return;
    try {
      await sendFinish(signer, tokenId);
    } catch (error) {
      if ((await readChest(signer, tokenId)).finished) return;
      throw error;
    }
  });
const sendFinish = async (signer: Signer, tokenId: string) => {
  const provider = rpcAt(signer.rpcUrl);
  const account = new Account({ provider, address: signer.accountAddress, signer: signer.privateKey });
  const transaction = await account.execute({
    contractAddress: signer.contractAddress,
    entrypoint: "open_finish",
    calldata: tokenLimbs(tokenId),
  });
  const receipt = await provider.waitForTransaction(transaction.transaction_hash);
  if (receipt.isReverted()) throw new Error("chest_finish_reverted");
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
