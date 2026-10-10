import { readGameEntry, type GameEntry } from "@realms-world/identity";
import { rpcAt, type LedgerGameKey } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";
/** Entry terms name the token this ledger charges at the confirmed opening head. */
export const paidGameEntry = (rpcUrl: string, address: string, key: LedgerGameKey) =>
  relayOperation("resolve paid game entry", async (): Promise<GameEntry> => {
    const provider = rpcAt(rpcUrl);
    const head = await provider.getBlock("latest");
    if (
      !("block_number" in head) ||
      !("status" in head) ||
      !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(head.status ?? "")
    )
      throw new Error("game_entry_head_unconfirmed");
    const fields = await provider.callContract(
      { contractAddress: address, entrypoint: "lords", calldata: [] },
      head.block_number,
    );
    if (fields.length !== 1 || BigInt(fields[0]!) <= 0n || BigInt(fields[0]!) >= (1n << 251n) - 256n)
      throw new Error("invalid_ledger_fee_token");
    const chainId = await provider.getChainId();
    return readGameEntry({
      kind: "paid",
      ledger: { address, chainId, feeToken: fields[0]!, shard: key.chainId, gameId: key.gameId },
    });
  });
