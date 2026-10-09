import { Effect } from "effect";
import { decodeBlitzResult } from "./shard-results";
import { ShardReader, felt, sameFelt, uint, type ValueRow } from "./shard-rpc";
import { RelayFailure, relayOperation, type RelayEffect, type RelayPorts, type Withdrawal } from "./ports";

interface ReceiptBindings {
  realmsIdForAccount(account: string): Promise<string | null>;
  frontierSeason(gameId: number): RelayEffect<number>;
}

/** A game id or a display ordinal cannot substitute for the unpublished funded-season binding. */
export const pendingFrontierBindings = (identity: Pick<ReceiptBindings, "realmsIdForAccount">): ReceiptBindings => ({
  realmsIdForAccount: (account) => identity.realmsIdForAccount(account),
  frontierSeason: () =>
    Effect.fail(new RelayFailure({ operation: "interface_unavailable:frontier.game_season_binding" })),
});

/** Receipt fields are immutable shard facts; identity and funding bindings are resolved separately. */
export const shardWithdrawalPorts = (
  reader: ShardReader,
  bindings: ReceiptBindings,
): Pick<RelayPorts["shard"], "confirmedHead" | "block" | "withdrawal"> => ({
  confirmedHead: () => relayOperation("read confirmed shard head", () => reader.head()),
  block: (number) =>
    Effect.gen(function* () {
      const { block, rows } = yield* relayOperation("read confirmed shard receipts", () => reader.block(number));
      const results = yield* relayOperation("decode confirmed Blitz results", async () =>
        rows
          .filter((row) => row.model === "BlitzResult")
          .flatMap((row) => {
            const result = decodeBlitzResult(reader.connection.chainId, row);
            return result ? [result] : [];
          }),
      );
      const withdrawals: Withdrawal[] = [];
      for (const row of rows.filter((row) => row.model === "LordsWithdrawal"))
        withdrawals.push(yield* resolveWithdrawal(reader, bindings, row, block.timestamp));
      return {
        chainId: felt(reader.connection.chainId),
        number: block.block_number,
        hash: block.block_hash,
        parentHash: block.parent_hash,
        status: block.status,
        withdrawals,
        results,
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
    const seasonId = yield* bindings.frontierSeason(receipt.gameId);
    return {
      chainId: felt(reader.connection.chainId),
      seasonId,
      transactionHash: row.transactionHash,
      realmsId,
      amount: receipt.amount,
      confirmedAt,
    };
  });
