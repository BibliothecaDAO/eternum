import { hash } from "starknet";
import { manifest, pointsAward, receipt } from "./fixtures";
import type { RpcBlockWithReceipts } from "../types";

const PLAY = hash.getSelectorFromName("play");
const hex = (value: number) => `0x${value.toString(16)}`;
const fullWidth = (value: string) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;

/** Full-width felts model large wire responses without changing their Cairo values. */
export function syntheticTransaction(index: number) {
  const transactionHash = hex(index + 100);
  const events = Array.from({ length: 6 }, (_, event) => {
    const raw = pointsAward("1", hex(index + 1000), "1", String(event + 1), String(index * 6 + event + 1));
    return { ...raw, keys: raw.keys.map(fullWidth), data: raw.data.map(fullWidth) };
  });
  return {
    transaction: {
      type: "INVOKE",
      transaction_hash: transactionHash,
      sender_address: hex(index + 1000),
      calldata: ["0x1", manifest.world.address, PLAY, "0x1", "0x1"],
    },
    receipt: { ...receipt(events, transactionHash), block_number: 10 },
  };
}

export function syntheticBlock(count: number): RpcBlockWithReceipts {
  return {
    block_number: 10,
    timestamp: 1800,
    transactions: Array.from({ length: count }, (_, i) => syntheticTransaction(i)),
  };
}

/** The fixture implements the bounded RPCs and deliberately refuses the retired whole-block RPC. */
export function blockRpcResult(block: RpcBlockWithReceipts, method: string, params: any[]) {
  if (method === "starknet_getBlockWithReceipts")
    throw new Error("Response is too big: Exceeded max limit of 15728640");
  if (method === "starknet_getBlockWithTxHashes")
    return {
      block_number: block.block_number,
      timestamp: block.timestamp,
      block_hash: "0xb10",
      status: "ACCEPTED_ON_L2",
      transactions: block.transactions.map(({ receipt }) => receipt.transaction_hash),
    };
  if (method === "starknet_getEvents") {
    const [filter] = params;
    const events = block.transactions.flatMap(({ receipt }, transaction_index) =>
      receipt.events.flatMap((event, event_index) =>
        BigInt(event.from_address) === BigInt(filter.address)
          ? [
              {
                ...event,
                block_number: block.block_number,
                block_hash: "0xb10",
                transaction_hash: receipt.transaction_hash,
                transaction_index,
                event_index,
              },
            ]
          : [],
      ),
    );
    const start = Number(filter.continuation_token ?? 0),
      end = start + filter.chunk_size;
    return { events: events.slice(start, end), ...(end < events.length ? { continuation_token: String(end) } : {}) };
  }
  const item = block.transactions.find(({ receipt }) => BigInt(receipt.transaction_hash) === BigInt(params[0]));
  if (!item) throw new Error("Unknown fixture transaction");
  if (method === "starknet_getTransactionByHash")
    return { ...item.transaction, transaction_hash: item.receipt.transaction_hash };
  if (method === "starknet_getTransactionStatus")
    return {
      finality_status: item.receipt.finality_status,
      execution_status: item.receipt.execution_status,
      ...(item.receipt.revert_reason ? { failure_reason: item.receipt.revert_reason } : {}),
    };
  if (method === "starknet_getTransactionReceipt") return item.receipt;
  throw new Error(`Unexpected fixture method ${method}`);
}
