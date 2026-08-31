#!/usr/bin/env bun
import { createRequire } from "node:module";
import { AndComposeClause, KeysClause, MemberClause } from "@dojoengine/sdk/node";
import { Account, RpcProvider } from "starknet";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import type { Clause, Entity, Subscription } from "@dojoengine/torii-wasm/node";
import {
  formatError,
  optionalInteger,
  optionalString,
  parseCliArgs,
  requirePositiveInteger,
  requireString,
  writeJsonReport,
} from "./shared/cli";
import {
  buildEntityQuery,
  createToriiClient,
  normalizeAddress,
  normalizeFelt,
  queryToriiSql,
  readEntityGameId,
  waitFor,
} from "./shared/torii";

const GAME_MODEL = "s2-GameRegistry";
const CLIENT_PACKAGE = "@dojoengine/torii-client";

type D16Schema = {
  s2: {
    GameRegistry: {
      game_id: number;
      creator: string;
    };
  };
};

interface D16Options {
  toriiUrl: string;
  rpcUrl: string;
  worldAddress: string;
  registrarContract: string;
  accountAddress: string;
  privateKey: string;
  gameIds: [number, number];
  timeoutMs: number;
}

interface ObservedUpdate {
  gameId?: number;
  playerIdentity?: string;
  hashedKeys: string;
}

interface FixtureTransaction {
  action: "sync_game_status";
  gameId: number;
  transactionHash: string;
}

export function buildD16Clauses(gameId: number, playerIdentity: string): Record<"keys" | "member" | "composite", Clause> {
  const normalizedPlayerIdentity = normalizeAddress(playerIdentity);
  const memberBuilder = MemberClause<D16Schema, "s2-GameRegistry", "game_id">(
    GAME_MODEL,
    "game_id",
    "Eq",
    { type: "U32", value: gameId },
  );
  const playerBuilder = MemberClause<D16Schema, "s2-GameRegistry", "creator">(
    GAME_MODEL,
    "creator",
    "Eq",
    { type: "ContractAddress", value: normalizedPlayerIdentity },
  );

  return {
    keys: KeysClause<D16Schema>([GAME_MODEL], [normalizeFelt(gameId)], "VariableLen").build(),
    member: memberBuilder.build(),
    composite: AndComposeClause<D16Schema>([
      KeysClause<D16Schema>([GAME_MODEL], [normalizeFelt(gameId)], "VariableLen"),
      playerBuilder,
    ]).build(),
  };
}

function readPlayerIdentity(entity: Entity): string | undefined {
  const value = entity.models[GAME_MODEL]?.creator;
  if (!value || value.type !== "primitive") {
    return undefined;
  }
  return typeof value.value === "string" ? normalizeAddress(value.value) : undefined;
}

function toObservedUpdate(entity: Entity): ObservedUpdate {
  return {
    gameId: readEntityGameId(entity, GAME_MODEL),
    playerIdentity: readPlayerIdentity(entity),
    hashedKeys: entity.hashed_keys,
  };
}

async function queryGameIds(client: Awaited<ReturnType<typeof createToriiClient>>, clause: Clause): Promise<number[]> {
  const response = await client.getEntities(buildEntityQuery(GAME_MODEL, clause));
  const gameIds = response.items.map((entity) => readEntityGameId(entity, GAME_MODEL));
  if (gameIds.some((gameId) => gameId === undefined)) {
    throw new Error("D16 query returned a GameRegistry entity without a decodable game_id");
  }
  return (gameIds as number[]).sort((left, right) => left - right);
}

async function requireMutableGames(options: D16Options): Promise<void> {
  const rows = await queryToriiSql(
    options.toriiUrl,
    `SELECT game_id, status, creator FROM "${GAME_MODEL}" WHERE game_id IN (${options.gameIds.join(",")}) ORDER BY game_id`,
  );
  if (rows.length !== 2) {
    throw new Error(`Expected both GameRegistry fixtures, observed ${JSON.stringify(rows)}`);
  }
  const expectedPlayer = normalizeAddress(options.accountAddress);
  for (const row of rows) {
    if (String(row.status) === "Ended" || String(row.status) === "Settled") {
      throw new Error(`Game ${String(row.game_id)} was already synced to ${String(row.status)}`);
    }
    if (normalizeAddress(String(row.creator)) !== expectedPlayer) {
      throw new Error(`Game ${String(row.game_id)} creator does not match the D16 player identity`);
    }
  }
}

async function executeStatusSync(account: Account, options: D16Options, gameId: number): Promise<FixtureTransaction> {
  const transaction = await account.execute({
    contractAddress: options.registrarContract,
    entrypoint: "sync_game_status",
    calldata: [normalizeFelt(gameId)],
  });
  const receipt = (await account.waitForTransaction(transaction.transaction_hash)) as {
    execution_status?: string;
    revert_reason?: string;
    isSuccess?: () => boolean;
  };
  const succeeded = receipt.isSuccess ? receipt.isSuccess() : receipt.execution_status !== "REVERTED";
  if (!succeeded) {
    throw new Error(receipt.revert_reason || "sync_game_status reverted");
  }
  return { action: "sync_game_status", gameId, transactionHash: transaction.transaction_hash };
}

async function waitForEndedGame(options: D16Options, gameId: number): Promise<void> {
  await waitFor(
    async () => {
      const rows = await queryToriiSql(
        options.toriiUrl,
        `SELECT status FROM "${GAME_MODEL}" WHERE game_id = ${gameId} LIMIT 1`,
      );
      return rows[0]?.status === "Ended";
    },
    { timeoutMs: options.timeoutMs, pollMs: 250, description: `game ${gameId} Ended status indexing` },
  );
}

async function subscribe(
  client: Awaited<ReturnType<typeof createToriiClient>>,
  clause: Clause,
  updates: ObservedUpdate[],
): Promise<Subscription> {
  return await client.onEntityUpdated(clause, (entity: Entity) => updates.push(toObservedUpdate(entity)));
}

function matrixRow(
  name: string,
  queryObserved: number[],
  subscriptionObserved: ObservedUpdate[],
  includedGameId: number,
  excludedGameId?: number,
): { name: string; expected: object; query: object; subscription: object; status: "PASS" | "FAIL" } {
  const queryPass = queryObserved.length > 0 && queryObserved.every((gameId) => gameId === includedGameId);
  const subscriptionPass =
    subscriptionObserved.length > 0 && subscriptionObserved.every((update) => update.gameId === includedGameId);
  return {
    name,
    expected: { includedGameId, ...(excludedGameId === undefined ? {} : { excludedGameId }) },
    query: { status: queryPass ? "PASS" : "FAIL", observedGameIds: queryObserved },
    subscription: {
      status: subscriptionPass ? "PASS" : "FAIL",
      observed: subscriptionObserved,
    },
    status: queryPass && subscriptionPass ? "PASS" : "FAIL",
  };
}

function resolveClientVersion(): string {
  const require = createRequire(import.meta.url);
  return (require(`${CLIENT_PACKAGE}/package.json`) as { version: string }).version;
}

async function runMatrix(options: D16Options): Promise<object> {
  const [gameOne, gameTwo] = options.gameIds;
  const playerIdentity = normalizeAddress(options.accountAddress);
  const clauses = buildD16Clauses(gameOne, playerIdentity);
  const client = await createToriiClient(options.toriiUrl, options.worldAddress);
  const provider = new RpcProvider({ nodeUrl: options.rpcUrl });
  await assertProviderChain(provider, "appchain", "--rpc-url");
  const account = new Account({
    provider,
    address: options.accountAddress,
    signer: options.privateKey,
  });
  const updates = {
    keys: [] as ObservedUpdate[],
    member: [] as ObservedUpdate[],
    composite: [] as ObservedUpdate[],
  };
  const subscriptions: Subscription[] = [];
  const fixtureTransactions: FixtureTransaction[] = [];

  try {
    await requireMutableGames(options);
    subscriptions.push(
      await subscribe(client, clauses.keys, updates.keys),
      await subscribe(client, clauses.member, updates.member),
      await subscribe(client, clauses.composite, updates.composite),
    );

    fixtureTransactions.push(await executeStatusSync(account, options, gameOne));
    await waitForEndedGame(options, gameOne);
    await waitFor(
      () => updates.keys.length > 0 && updates.member.length > 0 && updates.composite.length > 0,
      { timeoutMs: options.timeoutMs, description: "all game-one subscription callbacks" },
    );

    fixtureTransactions.push(await executeStatusSync(account, options, gameTwo));
    await waitForEndedGame(options, gameTwo);
    await Bun.sleep(1_000);

    const queryObservations = {
      keys: await queryGameIds(client, clauses.keys),
      member: await queryGameIds(client, clauses.member),
      composite: await queryGameIds(client, clauses.composite),
    };
    const rows = [
      matrixRow("key-prefix-game-1", queryObservations.keys, updates.keys, gameOne),
      matrixRow("game-2-excluded", queryObservations.keys, updates.keys, gameOne, gameTwo),
      matrixRow("member-game-id", queryObservations.member, updates.member, gameOne),
      matrixRow("composite-game-prefix-and-player", queryObservations.composite, updates.composite, gameOne),
    ];
    const status = rows.every((row) => row.status === "PASS") ? "PASS" : "FAIL";
    return {
      kind: "torii-s2-d16-matrix",
      generatedAt: new Date().toISOString(),
      status,
      sdk: {
        package: CLIENT_PACKAGE,
        version: resolveClientVersion(),
        runtimeBinding: "@dojoengine/torii-wasm/node",
      },
      inputs: {
        toriiUrl: options.toriiUrl,
        worldAddress: normalizeFelt(options.worldAddress),
        gameIds: options.gameIds,
        playerIdentity,
        playerIdentityMember: "creator",
        model: GAME_MODEL,
      },
      clauses,
      rows,
      fixtureTransactions,
    };
  } finally {
    for (const subscription of subscriptions) {
      subscription.cancel();
    }
    client.free();
  }
}

function parseGameIds(value: string): [number, number] {
  const values = value.split(",").map((entry) => Number(entry.trim()));
  if (
    values.length !== 2 ||
    values.some((entry) => !Number.isSafeInteger(entry) || entry <= 0) ||
    values[0] === values[1]
  ) {
    throw new Error("--game-ids must contain two distinct positive integers separated by a comma");
  }
  return [values[0]!, values[1]!];
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help === true) {
    console.log(
      "Usage: bun d16-verify.ts --torii-url <url> --rpc-url <url> --world <felt> --registrar-contract <felt> --account-address <felt> --private-key <felt> --game-ids <id,id> [--output <json>]",
    );
    return;
  }

  const options: D16Options = {
    toriiUrl: requireString(args, "torii-url"),
    rpcUrl: requireString(args, "rpc-url"),
    worldAddress: requireString(args, "world"),
    registrarContract: requireString(args, "registrar-contract"),
    accountAddress: requireString(args, "account-address"),
    privateKey: requireString(args, "private-key"),
    gameIds: parseGameIds(requireString(args, "game-ids")),
    timeoutMs: optionalInteger(args, "timeout-ms") ?? 120_000,
  };
  if (options.timeoutMs <= 0) {
    requirePositiveInteger(args, "timeout-ms");
  }

  const report = (await runMatrix(options)) as { status: "PASS" | "FAIL" };
  await writeJsonReport(report, optionalString(args, "output"));
  if (report.status === "FAIL") {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
