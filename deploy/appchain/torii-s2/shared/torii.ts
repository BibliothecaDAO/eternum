import { ToriiClient, type Clause, type Entity, type Query } from "@dojoengine/torii-wasm/node";

const DEFAULT_QUERY_LIMIT = 1_000;

export interface ToriiSqlRow extends Record<string, unknown> {}

export async function queryToriiSql(toriiUrl: string, query: string): Promise<ToriiSqlRow[]> {
  const url = `${normalizeToriiUrl(toriiUrl)}/sql?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`Torii SQL failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new Error("Torii SQL returned a non-array response");
  }
  return body as ToriiSqlRow[];
}

export async function queryGraphql<T>(toriiUrl: string, query: string): Promise<T> {
  const response = await fetch(`${normalizeToriiUrl(toriiUrl)}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Torii GraphQL failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (body.errors?.length) {
    throw new Error(`Torii GraphQL errors: ${body.errors.map((error) => error.message || "unknown").join("; ")}`);
  }
  if (!body.data) {
    throw new Error("Torii GraphQL returned no data");
  }
  return body.data;
}

export async function createToriiClient(toriiUrl: string, worldAddress: string): Promise<ToriiClient> {
  return await new ToriiClient({
    toriiUrl: normalizeToriiUrl(toriiUrl),
    worldAddress: normalizeFelt(worldAddress),
  });
}

export function buildEntityQuery(model: string, clause: Clause): Query {
  return {
    pagination: {
      limit: DEFAULT_QUERY_LIMIT,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    clause,
    no_hashed_keys: false,
    models: [model],
    historical: false,
  };
}

export function readEntityGameId(entity: Entity, model: string): number | undefined {
  const value = entity.models[model]?.game_id;
  if (!value || value.type !== "primitive") {
    return undefined;
  }
  return Number(value.value);
}

export function normalizeFelt(value: string | number | bigint): string {
  return `0x${BigInt(value).toString(16)}`;
}

export function normalizeAddress(value: string): string {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

export function normalizeToriiUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  options: { timeoutMs: number; pollMs?: number; description: string },
): Promise<void> {
  const startedAt = Date.now();
  const pollMs = options.pollMs ?? 100;

  while (Date.now() - startedAt <= options.timeoutMs) {
    if (await predicate()) {
      return;
    }
    await Bun.sleep(pollMs);
  }

  throw new Error(`Timed out waiting for ${options.description}`);
}
