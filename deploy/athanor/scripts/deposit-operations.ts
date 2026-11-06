import { checkDepositRetirement } from "../../../apps/value-relay/src/deposit-retirement";
import { readFileSync, writeFileSync } from "node:fs";
import { rpcAt, decodeCosigner } from "../../../packages/value-ledger/src/index";
import { depositReader } from "../../../packages/value-ledger/src/deposits";
import { readFrontierGames } from "../../../apps/value-relay/src/frontier-games";
import type { ShardConnection } from "../../../apps/value-relay/src/shard-rpc";

interface DepositDeployment {
  shard: ShardConnection & { heraldUrl: string };
  ledger: { rpcUrl: string; chainId: string; address: string };
  gameId: number;
  ledgerClassHash: string;
}

/** Prepares exact owner calls; this command has no signer or private-key input and submits nothing. */
export async function prepareDeposits(input: DepositDeployment) {
  const reader = await depositReader(rpcAt(input.ledger.rpcUrl), input.ledger.address, input.ledger.chainId);
  const signer = decodeCosigner(await reader.read("cosigner", []));
  const directory = await readFrontierGames(input.shard, input.shard.heraldUrl);
  if (!directory.games.some((game) => game.game_id === input.gameId)) throw new Error("deposit_game_not_frontier");
  if (BigInt(input.ledgerClassHash) <= 0n) throw new Error("reviewed_ledger_class_required");
  await reader.assertCanonical();
  return {
    ledgerChain: input.ledger.chainId,
    shardChain: input.shard.chainId,
    gameId: input.gameId,
    ledgerCalls: [
      { contractAddress: input.ledger.address, entrypoint: "upgrade", calldata: [input.ledgerClassHash] },
      {
        contractAddress: input.ledger.address,
        entrypoint: "enable_deposits",
        calldata: [input.shard.chainId, String(input.gameId), input.shard.gamesAddress],
      },
    ],
    shardCalls: [
      {
        contractAddress: input.shard.gamesAddress,
        entrypoint: "configure_deposits",
        calldata: [
          String(input.gameId),
          input.ledger.chainId,
          input.ledger.address,
          signer.publicKey,
          String(signer.epoch),
        ],
      },
    ],
    prerequisites: [
      "fresh root and matching schema deployed",
      "reward season funded separately",
      "independent signer configured for this shard",
      "reviewed root and ledger class sizes and storage layout",
      "candidate relay owns the ledger operator role",
      "publish deposit_source only after both contract and relay verification",
    ],
  };
}

if (import.meta.main) {
  const [command, path, out] = process.argv.slice(2);
  if (!path || !out || !["prepare", "retirement"].includes(command ?? ""))
    throw new Error("usage: deposit-operations.ts prepare|retirement INPUT.json OUTPUT.json");
  const input = JSON.parse(readFileSync(path, "utf8")) as DepositDeployment;
  const result = command === "prepare" ? await prepareDeposits(input) : await checkDepositRetirement(input);
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
}
