import { Account } from "starknet";
import { ledgerChestChanges } from "./ledger";
import { relayOperation, type ChestPorts } from "./ports";
import { rpcAt } from "./rpc";

interface Connection {
  rpcUrl: string;
  contractAddress: string;
}
interface Signer extends Connection {
  accountAddress: string;
  privateKey: string;
}

export const chestLedgerReads = (connection: Connection): Omit<ChestPorts, "finish"> => ({
  changes: (fromBlock, cursor) => ledgerChestChanges(connection.rpcUrl, connection.contractAddress, fromBlock, cursor),
  head: () =>
    relayOperation("read chest head", async () => {
      const block = await rpcAt(connection.rpcUrl).getBlock("latest");
      if (!("block_number" in block)) throw new Error("chest_head_not_confirmed");
      return block.block_number;
    }),
  chest: (tokenId) => relayOperation("read requested chest", () => readChest(connection, tokenId)),
  blockTime: (number) =>
    relayOperation("read chest eligibility time", async () => {
      const block = await rpcAt(connection.rpcUrl).getBlock(number);
      if (!("block_number" in block) || block.block_number !== number) throw new Error("wrong_eligibility_block");
      return block.timestamp;
    }),
});
export const finishChestOnLedger = (signer: Signer, tokenId: string) =>
  relayOperation("finish requested chest", async () => {
    const chest = await readChest(signer, tokenId);
    if (chest.finished) return;
    const provider = rpcAt(signer.rpcUrl);
    const account = new Account({ provider, address: signer.accountAddress, signer: signer.privateKey });
    const transaction = await account.execute({
      contractAddress: signer.contractAddress,
      entrypoint: "open_finish",
      calldata: tokenLimbs(tokenId),
    });
    const receipt = await provider.waitForTransaction(transaction.transaction_hash);
    if (receipt.isReverted()) throw new Error("chest_finish_reverted");
  });
const readChest = async (connection: Connection, tokenId: string) => {
  const fields = await rpcAt(connection.rpcUrl).callContract(
    { contractAddress: connection.contractAddress, entrypoint: "get_chest", calldata: tokenLimbs(tokenId) },
    "latest",
  );
  if (fields.length !== 7 || fields[0] === undefined || BigInt(fields[0]) !== 1n) throw new Error("invalid_chest");
  const requested = decodeBool(fields[3]!);
  const finished = decodeBool(fields[4]!);
  const requestBlock = Number(BigInt(fields[6]!));
  if (!Number.isSafeInteger(requestBlock) || requestBlock < 0) throw new Error("invalid_request_block");
  return { requested, finished, requester: fields[5]!, requestBlock };
};
const tokenLimbs = (value: string) => {
  const n = BigInt(value);
  if (n < 0n || n >= 2n ** 256n) throw new Error("invalid_chest_id");
  return [String(n & (2n ** 128n - 1n)), String(n >> 128n)];
};
const decodeBool = (value: string) => {
  const n = BigInt(value);
  if (n !== 0n && n !== 1n) throw new Error("invalid_chest_bool");
  return n === 1n;
};
