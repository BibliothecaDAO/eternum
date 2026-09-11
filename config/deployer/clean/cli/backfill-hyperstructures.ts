#!/usr/bin/env bun
import { Account, RpcProvider } from "starknet";
import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { assertProviderChain } from "@realms-world/chain";
import { resolveDeploymentEnvironment } from "../environment";
import { planHyperstructureIndexBackfill } from "../indexing/hyperstructure-index";
import { backfillCompletedHyperstructures } from "../registrar/calls";
import { parseArgs } from "./args";

const BATCH_SIZE = 16;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const environment = resolveDeploymentEnvironment(args.environment ?? "madara.blitz");
  const gameId = Number(args["game-id"]);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) throw new Error("--game-id must be a positive integer");
  const snapshot = await readSnapshot(
    required(args["herald-url"] ?? process.env.HERALD_URL, "--herald-url"),
    environment.chain,
    gameId,
  );
  const ids = planHyperstructureIndexBackfill(snapshot);
  const batches = completionBatches(ids);
  if (args["dry-run"] === "true") {
    console.log(JSON.stringify({ gameId, confirmedBlock: snapshot.confirmed_block, batches }));
    return;
  }
  const account = createAccount();
  await assertProviderChain(account, environment.chain, "RPC_URL");
  const transactions: string[] = [];
  for (const batch of batches) {
    const result = await backfillCompletedHyperstructures(account, gameId, batch.startIndex, batch.ids, environment.id);
    transactions.push(result.transactionHash);
  }
  console.log(JSON.stringify({ gameId, indexedHyperstructures: ids.length, transactions }));
}

function completionBatches(ids: number[]) {
  return Array.from({ length: Math.ceil(ids.length / BATCH_SIZE) }, (_, index) => ({
    startIndex: index * BATCH_SIZE,
    ids: ids.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  }));
}

async function readSnapshot(baseUrl: string, chain: string, gameId: number): Promise<HeraldGameSnapshot> {
  const url = `${baseUrl.replace(/\/$/, "")}/${chain}/games/${gameId}/snapshot?models=Hyperstructure,HyperstructureGlobals,CompletedHyperstructure`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Herald snapshot failed: ${response.status}`);
  const snapshot = (await response.json()) as HeraldGameSnapshot;
  if (Number(snapshot.game_id) !== gameId) throw new Error("Herald snapshot contains a different game");
  return snapshot;
}

function createAccount(): Account {
  const provider = new RpcProvider({ nodeUrl: required(process.env.RPC_URL, "RPC_URL") });
  return new Account({
    provider,
    address: required(process.env.DOJO_ACCOUNT_ADDRESS, "DOJO_ACCOUNT_ADDRESS"),
    signer: required(process.env.DOJO_PRIVATE_KEY, "DOJO_PRIVATE_KEY"),
  });
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
