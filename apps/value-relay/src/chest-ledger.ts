import { Account } from "starknet";
import { ledgerChestChanges } from "./ledger";
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

export const chestLedgerReads = (connection: Connection): Omit<ChestPorts, "finish"> => ({
  changes: (fromBlock, cursor, anchor) =>
    ledgerChestChanges(connection.rpcUrl, connection.contractAddress, fromBlock, cursor, anchor),
  head: () =>
    relayOperation("read chest head", async () => {
      return (await readConfirmedLedgerHead(rpcAt(connection.rpcUrl))).number;
    }),
  chest: (tokenId) => relayOperation("read requested chest", () => readChest(connection, tokenId)),
});
export const finishChestOnLedger = (signer: Signer, tokenId: string) =>
  relayOperation("finish requested chest", async () => {
    const chest = await readChest(signer, tokenId);
    if (chest.finished) return;
    try {
      await submitFinish(signer, tokenId);
    } catch (error) {
      // Dev and production share the ledger and each relay finishes every requested chest: the other may finish first.
      if ((await readChest(signer, tokenId)).finished) return;
      throw error;
    }
  });
const submitFinish = async (signer: Signer, tokenId: string) => {
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
