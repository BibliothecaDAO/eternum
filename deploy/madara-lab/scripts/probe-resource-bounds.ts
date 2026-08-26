#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CallData, RpcProvider, type Account, type Call, type ResourceBoundsBN } from "starknet";
import { resolveGameTransactionResourceBounds } from "../../../packages/core/src/account/transaction-resource-bounds";
import { createHarnessAccounts } from "../harness/account-factory";
import {
  prepareHarnessBots,
  type HarnessSystemAddresses,
  type TrackedTransaction,
} from "../harness/driver";

interface GameplayContractsArtifact {
  bindingAuthorityAddress: string;
  playerAccountClassHash: string;
}

interface WorldManifest {
  contracts: Array<{ address: string; tag: string }>;
}

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const LAB_DIRECTORY = path.resolve(import.meta.dir, "..");
const RPC_URL = "http://127.0.0.1:5060/rpc/v0_9_0";
const TORII_SQL_URL = "http://127.0.0.1:8090/sql";

await runProbe(parseGameId(process.argv[2]));

async function runProbe(gameId: number): Promise<void> {
  const { account, bot, provider, systems } = await prepareProbeBot(gameId);
  const fixedZeroPrice = await attemptExplorerMove(
    provider,
    bot.account,
    buildExplorerMoveCall(
      gameId,
      systems.troopMovement,
      bot.explorers[0]!.explorerId,
      bot.explorers[0]!.outwardDirection,
    ),
    resolveGameTransactionResourceBounds("madara"),
  );
  const allZero = await attemptExplorerMove(
    provider,
    bot.account,
    buildExplorerMoveCall(
      gameId,
      systems.troopMovement,
      bot.explorers[1]!.explorerId,
      bot.explorers[1]!.outwardDirection,
    ),
    allZeroBounds(),
  );

  console.log(JSON.stringify({ account, allZero, fixedZeroPrice, gameId }, null, 2));
}

async function prepareProbeBot(gameId: number) {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const [gameplayContracts, manifest] = await Promise.all([
    readJson<GameplayContractsArtifact>(path.join(LAB_DIRECTORY, ".lab/gameplay-contracts.json")),
    readJson<WorldManifest>(path.join(REPOSITORY_ROOT, "contracts/game/manifest_madara.json")),
  ]);
  const systems = resolveSystemAddresses(manifest);
  const [account] = await createHarnessAccounts({
    authority: gameplayContracts.bindingAuthorityAddress,
    classHash: gameplayContracts.playerAccountClassHash,
    count: 1,
    provider,
  });
  if (!account) throw new Error("Gameplay account creation returned no account");

  const setupTransactions: TrackedTransaction[] = [];
  const [bot] = await prepareHarnessBots({
    accounts: [account],
    gameId,
    provider,
    setupTransactions,
    systems,
    toriiSqlUrl: TORII_SQL_URL,
  });
  if (!bot) throw new Error("Harness setup returned no bot");
  return { account: account.address, bot, provider, systems };
}

async function attemptExplorerMove(
  rpcProvider: RpcProvider,
  account: Account,
  call: Call,
  resourceBounds: ResourceBoundsBN,
) {
  const startedAt = performance.now();
  try {
    const result = await account.execute(call, { resourceBounds, tip: 0 });
    await rpcProvider.waitForTransaction(result.transaction_hash, { retryInterval: 50 });
    return {
      accepted: true,
      elapsedMs: Math.round(performance.now() - startedAt),
      transactionHash: result.transaction_hash,
    };
  } catch (error) {
    return {
      accepted: false,
      elapsedMs: Math.round(performance.now() - startedAt),
      error: errorText(error),
    };
  }
}

function buildExplorerMoveCall(gameId: number, contractAddress: string, explorerId: string, direction: number): Call {
  return {
    contractAddress,
    entrypoint: "explorer_move",
    calldata: CallData.compile([gameId, explorerId, [direction], true]),
  };
}

function parseGameId(value: string | undefined): number {
  const gameId = Number(value);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    throw new Error("Usage: pnpm lab:probe-bounds -- <game-id>");
  }
  return gameId;
}

function allZeroBounds(): ResourceBoundsBN {
  return {
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: 0n, max_price_per_unit: 0n },
  };
}

function resolveSystemAddresses(manifest: WorldManifest): HarnessSystemAddresses {
  return {
    blitzRealm: requireContract(manifest, "s2-blitz_realm_systems"),
    production: requireContract(manifest, "s2-production_systems"),
    troopManagement: requireContract(manifest, "s2-troop_management_systems"),
    troopMovement: requireContract(manifest, "s2-troop_movement_systems"),
  };
}

function requireContract(manifest: WorldManifest, tag: string): string {
  const address = manifest.contracts.find((contract) => contract.tag === tag)?.address;
  if (!address || BigInt(address) === 0n) throw new Error(`Manifest does not define ${tag}`);
  return address;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
