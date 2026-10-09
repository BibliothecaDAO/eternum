import { Effect, Result } from "effect";
import { decodeBlitzResult } from "./shard-results";
import { ShardReader, felt, sameFelt, uint, type ValueRow } from "./shard-rpc";
import {
  RelayFailure,
  relayOperation,
  type RelayEffect,
  type RelayPorts,
  type Withdrawal,
  type HeldObligation,
} from "./ports";

interface ReceiptBindings {
  realmsIdForAccount(account: string): Promise<string | null>;
  frontierSeason(gameId: number, confirmedAt: number): RelayEffect<number>;
}

/** Receipt fields are immutable shard facts; identity and funding bindings are resolved separately. */
export const shardWithdrawalPorts = (
  reader: ShardReader,
  bindings: ReceiptBindings,
): Pick<RelayPorts["shard"], "confirmedHead" | "blockHash" | "eventsPage" | "withdrawal"> => ({
  confirmedHead: () => relayOperation("read confirmed shard head", () => reader.head()),
  blockHash: (number) =>
    relayOperation("read confirmed shard anchor", async () => (await reader.header(number)).block_hash),
  eventsPage: (from, to, cursor) =>
    Effect.gen(function* () {
      const { block, first, rows, next } = yield* relayOperation("read confirmed shard receipts", () =>
        reader.page(from, to, cursor),
      );
      const results: import("./ports").BlitzResult[] = [];
      const withdrawals: Withdrawal[] = [];
      const held: HeldObligation[] = rows
        .filter((row) => row.model === "MalformedValueEvent")
        .map((row) => ({
          kind: "row",
          reason: "decode confirmed value event",
          row: { ...row, chainId: reader.connection.chainId, blockNumber: row.blockNumber ?? block.block_number },
        }));
      for (const row of rows.filter((row) => row.model === "BlitzResult")) {
        try {
          const result = decodeBlitzResult(reader.connection.chainId, row);
          if (result) results.push({ ...result, blockNumber: row.blockNumber ?? block.block_number });
        } catch {
          held.push({
            kind: "row",
            reason: "decode confirmed Blitz result",
            row: { ...row, chainId: reader.connection.chainId, blockNumber: row.blockNumber ?? block.block_number },
          });
        }
      }
      for (const row of rows.filter((row) => row.model === "LordsWithdrawal")) {
        const resolved = yield* Effect.result(resolveWithdrawal(reader, bindings, row, row.confirmedAt));
        if (Result.isSuccess(resolved)) withdrawals.push(resolved.success);
        else
          held.push({
            kind: "receipt",
            reason: resolved.failure.operation,
            receipt: {
              chainId: felt(reader.connection.chainId),
              transactionHash: row.transactionHash,
              keys: row.keys,
              values: row.values,
              confirmedAt: row.confirmedAt,
            },
          });
      }
      return {
        chainId: felt(reader.connection.chainId),
        number: block.block_number,
        hash: block.block_hash,
        parentHash: first.parent_hash,
        fromBlock: from,
        next,
        status: block.status,
        withdrawals,
        results,
        held,
      };
    }),
  withdrawal: (chainId, transactionHash) =>
    Effect.gen(function* () {
      if (!sameFelt(chainId, reader.connection.chainId))
        return yield* Effect.fail(new RelayFailure({ operation: "receipt_chain_differs" }));
      const receipt = yield* relayOperation("read withdrawal transaction", () => reader.receipt(transactionHash));
      if (!receipt) return null;
      const rows = receipt.rows.filter((row) => row.model === "LordsWithdrawal");
      if (rows.length > 1) return yield* Effect.fail(new RelayFailure({ operation: "duplicate_withdrawal_receipt" }));
      return rows[0] ? yield* resolveWithdrawal(reader, bindings, rows[0], receipt.timestamp) : null;
    }),
});
const resolveWithdrawal = (reader: ShardReader, bindings: ReceiptBindings, row: ValueRow, confirmedAt: number) =>
  Effect.gen(function* () {
    const receipt = yield* relayOperation("decode withdrawal receipt", async () => {
      if (row.keys.length !== 2 || row.values.length !== 2 || !sameFelt(row.keys[1]!, row.transactionHash))
        throw new Error("invalid_withdrawal_receipt");
      const gameId = Number(uint(row.keys[0]!, 32));
      const account = felt(row.values[0]!);
      const amount = uint(row.values[1]!, 128);
      if (!gameId || BigInt(account) === 0n || amount === 0n) throw new Error("invalid_withdrawal_receipt");
      return { gameId, account, amount: String(amount * 10n ** 18n) };
    });
    const realmsId = yield* relayOperation("resolve withdrawal account", () =>
      bindings.realmsIdForAccount(receipt.account),
    );
    if (!realmsId) return yield* Effect.fail(new RelayFailure({ operation: "withdrawal_account_unknown" }));
    const seasonId = yield* bindings.frontierSeason(receipt.gameId, confirmedAt);
    return {
      ...(row.blockNumber === undefined ? {} : { blockNumber: row.blockNumber }),
      chainId: felt(reader.connection.chainId),
      seasonId,
      transactionHash: row.transactionHash,
      realmsId,
      amount: receipt.amount,
      confirmedAt,
    };
  });
