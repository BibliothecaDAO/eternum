import type { IndexerCreationResult, IndexerRequest } from "../types";

const DEFAULT_TORII_URL = process.env.APPCHAIN_TORII_URL ?? "https://torii.jcndata.com";
const DEFAULT_INDEXING_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_INDEXING_POLL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type Sleep = (durationMs: number) => Promise<void>;

export interface AppchainIndexerOptions {
  onProgress?: (message: string) => void;
  toriiUrl?: string;
  indexingTimeoutMs?: number;
  indexingPollMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: () => number;
}

interface AppchainIndexerRuntime {
  fetchImpl: typeof fetch;
  indexingPollMs: number;
  indexingTimeoutMs: number;
  now: () => number;
  onProgress: (message: string) => void;
  requestTimeoutMs: number;
  sleep: Sleep;
  toriiUrl: string;
}

const defaultSleep: Sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

/** Torii stores world addresses zero-padded to 64 hex chars. */
export const paddedWorldAddress = (address: string): string =>
  `0x${BigInt(address).toString(16).padStart(64, "0")}`;

/**
 * The shared appchain torii discovers factory-deployed worlds on its own
 * (`indexing.world_registry_models` watches wf-WorldDeployed), so creating an
 * indexer needs no registration call and no credentials: the world is live
 * once torii both registered it and serves its data. This just waits for that.
 */
export async function createAppchainIndexer(
  request: IndexerRequest,
  options: AppchainIndexerOptions = {},
): Promise<IndexerCreationResult> {
  const runtime = resolveRuntime(options);
  await waitForWorldToBeServed(runtime, request.worldAddress);

  return {
    mode: "github-actions",
    action: "already-live",
  };
}

function resolveRuntime(options: AppchainIndexerOptions): AppchainIndexerRuntime {
  return {
    fetchImpl: options.fetchImpl ?? fetch,
    indexingPollMs: options.indexingPollMs ?? DEFAULT_INDEXING_POLL_MS,
    indexingTimeoutMs: options.indexingTimeoutMs ?? DEFAULT_INDEXING_TIMEOUT_MS,
    now: options.now ?? Date.now,
    onProgress: options.onProgress ?? (() => {}),
    requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    sleep: options.sleep ?? defaultSleep,
    toriiUrl: (options.toriiUrl ?? DEFAULT_TORII_URL).replace(/\/+$/, ""),
  };
}

async function waitForWorldToBeServed(runtime: AppchainIndexerRuntime, worldAddress: string): Promise<void> {
  const padded = paddedWorldAddress(worldAddress);
  runtime.onProgress(`waiting for the shared torii to discover and index world ${padded}`);

  const deadline = runtime.now() + runtime.indexingTimeoutMs;
  let registered = false;

  while (runtime.now() < deadline) {
    if (!registered) {
      registered = await queryHasRows(
        runtime,
        `SELECT 1 AS ok FROM contracts WHERE contract_address = '${padded}' LIMIT 1;`,
      );
      if (registered) {
        runtime.onProgress(`torii auto-registered world ${padded}`);
      }
    }

    if (registered) {
      const served = await queryHasRows(runtime, `SELECT 1 AS ok FROM entities WHERE world_address = '${padded}' LIMIT 1;`);
      if (served) {
        runtime.onProgress(`torii serves world ${padded}`);
        return;
      }
    }

    await runtime.sleep(runtime.indexingPollMs);
  }

  throw new Error(
    `Torii did not serve world ${padded} within ${runtime.indexingTimeoutMs}ms ` +
      `(auto-registration ${registered ? "happened, but no entity data arrived" : "never happened"} — ` +
      `check that torii's indexing.world_registry_models includes wf-WorldDeployed)`,
  );
}

async function queryHasRows(runtime: AppchainIndexerRuntime, query: string): Promise<boolean> {
  try {
    const response = await runtime.fetchImpl(`${runtime.toriiUrl}/sql?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(runtime.requestTimeoutMs),
    });
    if (!response.ok) return false;
    const rows = (await response.json()) as unknown;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}
