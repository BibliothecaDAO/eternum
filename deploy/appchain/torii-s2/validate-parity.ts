#!/usr/bin/env bun
import type { Clause } from "@dojoengine/torii-wasm/node";
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
  normalizeFelt,
  queryGraphql,
  queryToriiSql,
  readEntityGameId,
  waitFor,
} from "./shared/torii";

const MODEL_PROFILES = [
  { tag: "s2_blitz-GameRegistry", graphqlField: "s2BlitzGameRegistryModels" },
  { tag: "s2_blitz-Structure", graphqlField: "s2BlitzStructureModels" },
  { tag: "s2_blitz-TileOpt", graphqlField: "s2BlitzTileOptModels" },
  { tag: "s2_blitz-Resource", graphqlField: "s2BlitzResourceModels" },
] as const;

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL";
  observed?: unknown;
  error?: string;
}

interface ParityOptions {
  toriiUrl: string;
  rpcUrl: string;
  worldAddress: string;
  gameIds: [number, number];
  expectedHead?: number;
  bootstrapStartedAtMs?: number;
  timeoutMs: number;
}

async function captureCheck(name: string, check: () => Promise<unknown>): Promise<CheckResult> {
  try {
    return { name, status: "PASS", observed: await check() };
  } catch (error) {
    return { name, status: "FAIL", error: formatError(error) };
  }
}

async function fetchRpcHead(rpcUrl: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_blockNumber", params: [] }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json()) as { result?: number; error?: { message?: string } };
  if (!response.ok || !Number.isSafeInteger(body.result)) {
    throw new Error(body.error?.message || `RPC head query failed with ${response.status}`);
  }
  return body.result!;
}

async function readToriiHead(toriiUrl: string): Promise<number> {
  const rows = await queryToriiSql(toriiUrl, "SELECT MAX(head) AS head FROM contracts");
  const value = rows[0]?.head;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Torii returned an invalid contract head: ${String(value)}`);
  }
  return parsed;
}

async function validateBootstrap(options: ParityOptions): Promise<unknown> {
  const expectedHead = options.expectedHead ?? (await fetchRpcHead(options.rpcUrl));
  await waitFor(async () => (await readToriiHead(options.toriiUrl)) >= expectedHead, {
    timeoutMs: options.timeoutMs,
    pollMs: 250,
    description: `Torii to reach block ${expectedHead}`,
  });

  const indexedHead = await readToriiHead(options.toriiUrl);
  return {
    worldBlock: 0,
    expectedHead,
    indexedHead,
    durationMs: options.bootstrapStartedAtMs ? Date.now() - options.bootstrapStartedAtMs : null,
  };
}

async function validateSqlIsolation(options: ParityOptions): Promise<unknown> {
  const observations: Record<string, Array<{ gameId: number; count: number }>> = {};
  const expectedIds = [...options.gameIds].sort((left, right) => left - right);

  for (const profile of MODEL_PROFILES) {
    const rows = await queryToriiSql(
      options.toriiUrl,
      `SELECT game_id, COUNT(*) AS count FROM "${profile.tag}" WHERE game_id IN (${expectedIds.join(",")}) GROUP BY game_id ORDER BY game_id`,
    );
    const modelRows = rows.map((row) => ({ gameId: Number(row.game_id), count: Number(row.count) }));
    if (
      modelRows.length !== expectedIds.length ||
      modelRows.some((row, index) => row.gameId !== expectedIds[index] || row.count <= 0)
    ) {
      throw new Error(`${profile.tag} does not contain isolated rows for both games: ${JSON.stringify(modelRows)}`);
    }
    observations[profile.tag] = modelRows;
  }

  return observations;
}

async function validateGraphql(options: ParityOptions): Promise<unknown> {
  const observations: Record<string, Record<string, number[]>> = {};

  for (const profile of MODEL_PROFILES) {
    observations[profile.tag] = {};
    for (const gameId of options.gameIds) {
      const query = `query { ${profile.graphqlField}(where: { game_idEQ: ${gameId} }) { edges { node { game_id } } totalCount } }`;
      const data = await queryGraphql<
        Record<string, { edges: Array<{ node: { game_id: number } }>; totalCount: number }>
      >(options.toriiUrl, query);
      const connection = data[profile.graphqlField];
      const returnedIds = connection?.edges.map((edge) => edge.node.game_id) ?? [];
      if (!connection || connection.totalCount <= 0 || returnedIds.some((returnedId) => returnedId !== gameId)) {
        throw new Error(`${profile.graphqlField} game_idEQ ${gameId} returned ${JSON.stringify(connection)}`);
      }
      observations[profile.tag]![String(gameId)] = returnedIds;
    }
  }

  return observations;
}

async function validateGrpc(options: ParityOptions): Promise<unknown> {
  const client = await createToriiClient(options.toriiUrl, options.worldAddress);
  const observations: Record<string, Record<string, number[]>> = {};

  try {
    for (const profile of MODEL_PROFILES) {
      observations[profile.tag] = {};
      for (const gameId of options.gameIds) {
        const clause: Clause = {
          Keys: {
            keys: [normalizeFelt(gameId)],
            pattern_matching: "VariableLen",
            models: [profile.tag],
          },
        };
        const response = await client.getEntities(buildEntityQuery(profile.tag, clause));
        const returnedIds = response.items.map((entity) => readEntityGameId(entity, profile.tag));
        if (returnedIds.some((returnedId) => returnedId === undefined)) {
          throw new Error(`${profile.tag} returned an entity without a decodable game_id`);
        }
        if (returnedIds.length === 0 || returnedIds.some((returnedId) => returnedId !== gameId)) {
          throw new Error(`${profile.tag} key prefix ${gameId} returned ${JSON.stringify(returnedIds)}`);
        }
        observations[profile.tag]![String(gameId)] = returnedIds as number[];
      }
    }
  } finally {
    client.free();
  }

  return observations;
}

function parseGameIds(value: string): [number, number] {
  const gameIds = value.split(",").map((entry) => Number(entry.trim()));
  if (
    gameIds.length !== 2 ||
    gameIds.some((gameId) => !Number.isSafeInteger(gameId) || gameId <= 0) ||
    gameIds[0] === gameIds[1]
  ) {
    throw new Error("--game-ids must contain two distinct positive integers separated by a comma");
  }
  return [gameIds[0]!, gameIds[1]!];
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help === true) {
    console.log(
      "Usage: bun validate-parity.ts --torii-url <url> --rpc-url <url> --world <felt> --game-ids <id,id> [--expected-head <n>] [--bootstrap-started-at-ms <ms>] [--output <json>]",
    );
    return;
  }

  const options: ParityOptions = {
    toriiUrl: requireString(args, "torii-url"),
    rpcUrl: requireString(args, "rpc-url"),
    worldAddress: requireString(args, "world"),
    gameIds: parseGameIds(requireString(args, "game-ids")),
    expectedHead: optionalInteger(args, "expected-head"),
    bootstrapStartedAtMs: optionalInteger(args, "bootstrap-started-at-ms"),
    timeoutMs: optionalInteger(args, "timeout-ms") ?? 120_000,
  };
  if (options.timeoutMs <= 0) {
    requirePositiveInteger(args, "timeout-ms");
  }

  const checks = await Promise.all([
    captureCheck("bootstrap-block-0-to-head", () => validateBootstrap(options)),
    captureCheck("sql-game-id-isolation", () => validateSqlIsolation(options)),
    captureCheck("graphql-game-id-eq", () => validateGraphql(options)),
    captureCheck("grpc-nested-model-fetch", () => validateGrpc(options)),
  ]);
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  await writeJsonReport(
    {
      kind: "torii-s2-parity",
      generatedAt: new Date().toISOString(),
      status,
      inputs: {
        toriiUrl: options.toriiUrl,
        rpcUrl: options.rpcUrl,
        worldAddress: normalizeFelt(options.worldAddress),
        gameIds: options.gameIds,
      },
      checks,
    },
    optionalString(args, "output"),
  );
  if (status === "FAIL") {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
