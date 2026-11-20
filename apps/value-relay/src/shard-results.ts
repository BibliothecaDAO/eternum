import { readShardAbi } from "../../../packages/value-ledger/src/shard-abi";
import { relayOperation, type BlitzResult, type MonitorPorts } from "./ports";
import { ShardReader, felt, sameFelt, uint, type ValueRow } from "./shard-rpc";
import { blitzCommitment, blitzResultFields } from "@realms-world/value-ledger/commitment";

/** Only a complete, canonical wallet/rank record with its matching v3 commitment is deliverable. */
export const decodeBlitzResult = (chainId: string, row: ValueRow): BlitzResult | null => {
  if (row.model !== "BlitzResult" || row.keys.length !== 1) throw new Error("invalid_result_key");
  const gameId = Number(uint(row.keys[0]!, 32));
  const count = Number(uint(row.values[0]!, 8));
  const fields = blitzResultFields(row.values);
  if (!gameId || count > 24) throw new Error("invalid_result_layout");
  const rows = fields.rows.map(({ wallet, rank }) => ({ wallet: felt(wallet), rank: Number(uint(rank, 16)) }));
  const complete = uint(fields.complete, 1) === 1n;
  const commitment = felt(fields.commitment);
  if (!complete) {
    if (count !== 0 || BigInt(commitment) !== 0n) throw new Error("invalid_incomplete_result");
    return null;
  }
  const result = { chainId: felt(chainId), gameId, rows, commitment };
  if (!count || !sameFelt(blitzCommitment(result), commitment)) throw new Error("result_commitment_differs");
  return result;
};

export const shardResultPort =
  (reader: ShardReader): MonitorPorts["shard"]["result"] =>
  (chainId, gameId) =>
    relayOperation("read confirmed Blitz result", async () => {
      if (!sameFelt(chainId, reader.connection.chainId) || !uint(String(gameId), 32))
        throw new Error("result_game_differs");
      const head = await reader.head();
      const provider = reader.provider();
      validateResultAbi(await readShardAbi(provider, reader.connection.gamesAddress, head));
      const span = await provider.callContract(
        { contractAddress: reader.connection.gamesAddress, entrypoint: "game_result", calldata: [String(gameId)] },
        head,
      );
      return decodeBlitzResult(chainId, {
        model: "BlitzResult",
        keys: [String(gameId)],
        values: spanValues(span),
        transactionHash: "0x0",
      });
    });

const spanValues = ([length, ...values]: string[]) => {
  if (length === undefined || Number(uint(length, 32)) !== values.length) throw new Error("invalid_result_span");
  return values;
};

const validateResultAbi = (raw: unknown) => {
  const abi = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(abi)) throw new Error("result_abi_unavailable");
  const items = abi.flatMap((item) => (item.type === "interface" ? item.items : [item]));
  const entry = items.find((item) => item.type === "function" && item.name === "game_result");
  if (
    entry?.inputs?.length !== 1 ||
    !entry.inputs[0].type.endsWith("::u32") ||
    entry.outputs?.length !== 1 ||
    entry.outputs[0].type !== "core::array::Span::<core::felt252>"
  )
    throw new Error("result_abi_mismatch");
};
