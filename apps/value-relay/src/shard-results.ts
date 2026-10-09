import { relayOperation, type BlitzResult, type RelayPorts } from "./ports";
import { ShardReader, felt, sameFelt, uint, type ValueRow } from "./shard-rpc";
import { blitzCommitment } from "@realms-world/value-ledger/commitment";

/** Only a complete, canonical wallet/rank record with its matching v3 commitment is deliverable. */
export const decodeBlitzResult = (chainId: string, row: ValueRow): BlitzResult | null => {
  if (row.model !== "BlitzResult" || row.keys.length !== 1) throw new Error("invalid_result_key");
  const gameId = Number(uint(row.keys[0]!, 32));
  const count = Number(uint(row.values[0]!, 8));
  if (!gameId || count > 24 || row.values.length !== 2 * count + 3) throw new Error("invalid_result_layout");
  const rows = Array.from({ length: count }, (_, index) => ({
    wallet: felt(row.values[1 + 2 * index]!),
    rank: Number(uint(row.values[2 + 2 * index]!, 16)),
  }));
  validateRanks(rows);
  const complete = uint(row.values[1 + 2 * count]!, 1) === 1n;
  const commitment = felt(row.values[2 + 2 * count]!);
  if (!complete) {
    if (BigInt(commitment) !== 0n) throw new Error("partial_result_commitment");
    return null;
  }
  const result = { chainId: felt(chainId), gameId, rows, commitment };
  if (!count || !sameFelt(blitzCommitment(result), commitment)) throw new Error("result_commitment_differs");
  return result;
};

export const shardResultPort =
  (reader: ShardReader): RelayPorts["shard"]["result"] =>
  (chainId, gameId) =>
    relayOperation("read confirmed Blitz result", async () => {
      if (!sameFelt(chainId, reader.connection.chainId) || !uint(String(gameId), 32))
        throw new Error("result_game_differs");
      const head = await reader.head();
      const provider = reader.provider();
      const contract = await provider.getClassAt(reader.connection.gamesAddress, head);
      validateResultAbi(contract.abi);
      const values = await provider.callContract(
        { contractAddress: reader.connection.gamesAddress, entrypoint: "blitz_result", calldata: [String(gameId)] },
        head,
      );
      return decodeBlitzResult(chainId, {
        model: "BlitzResult",
        keys: [String(gameId)],
        values,
        transactionHash: "0x0",
      });
    });

const validateRanks = (rows: BlitzResult["rows"]) => {
  const wallets = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const prior = rows[index - 1];
    const sameRank = prior?.rank === row.rank;
    if (
      BigInt(row.wallet) === 0n ||
      wallets.has(row.wallet) ||
      (sameRank ? BigInt(row.wallet) <= BigInt(prior!.wallet) : row.rank !== index + 1)
    )
      throw new Error("noncanonical_result_rank");
    wallets.add(row.wallet);
  }
};

const validateResultAbi = (raw: unknown) => {
  const abi = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(abi)) throw new Error("result_abi_unavailable");
  const items = abi.flatMap((item) => (item.type === "interface" ? item.items : [item]));
  const entry = items.find((item) => item.type === "function" && item.name === "blitz_result");
  const result = items.find((item) => item.type === "struct" && item.name === entry?.outputs?.[0]?.type);
  const ranked = items.find((item) => item.type === "struct" && item.name.endsWith("::RankedPlayer"));
  if (
    entry?.inputs?.length !== 1 ||
    !entry.inputs[0].type.endsWith("::u32") ||
    entry.outputs.length !== 1 ||
    result?.members?.map((member: { name: string }) => member.name).join() !== "players,complete,commitment" ||
    !ranked ||
    result.members[0].type !== `core::array::Span::<${ranked.name}>` ||
    result.members[1].type !== "core::bool" ||
    result.members[2].type !== "core::felt252" ||
    ranked.members
      ?.map((member: { name: string; type: string }) => `${member.name}:${member.type.split("::").at(-1)}`)
      .join() !== "wallet:ContractAddress,rank:u16"
  )
    throw new Error("result_abi_mismatch");
};
