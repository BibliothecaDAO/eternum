import {
  decodePaddedFeltAscii,
  extractNameFelt,
  fetchFactoryRows,
  getFactorySqlBaseUrl,
} from "../../../../common/factory/endpoints";
import { setTimeout as sleep } from "node:timers/promises";

export interface AppchainGameRegistryRow extends Record<string, unknown> {
  gameId: number;
}

const GAME_REGISTRY_TABLE = '"s2_blitz-GameRegistry"';
const CHAIN_CONFIG_TABLE = '"s2_blitz-ChainConfig"';
const PRESET_TABLE = '"s2_blitz-Preset"';

function resolveToriiSqlUrl(cartridgeApiBase?: string): string {
  const sqlUrl = getFactorySqlBaseUrl("appchain", cartridgeApiBase);
  if (!sqlUrl) {
    throw new Error("TORII_URL is required for appchain indexing checks");
  }
  return sqlUrl;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(BigInt(value));
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readNestedData(row: Record<string, unknown>): Record<string, unknown> {
  if (typeof row.data === "object" && row.data && !Array.isArray(row.data)) {
    return row.data as Record<string, unknown>;
  }
  if (typeof row.data === "string") {
    try {
      const parsed = JSON.parse(row.data) as unknown;
      return typeof parsed === "object" && parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function readGameId(row: Record<string, unknown>): number | undefined {
  return parseInteger(row.game_id ?? row["key.game_id"] ?? readNestedData(row).game_id);
}

function toGameRegistryRow(row: Record<string, unknown>): AppchainGameRegistryRow | null {
  const gameId = readGameId(row);
  return gameId ? { ...row, gameId } : null;
}

function rowMatchesGameName(row: Record<string, unknown>, gameName: string): boolean {
  const encodedName = extractNameFelt(row);
  return encodedName === gameName || (encodedName !== null && decodePaddedFeltAscii(encodedName) === gameName);
}

async function fetchRows(query: string, cartridgeApiBase?: string): Promise<Record<string, unknown>[]> {
  return fetchFactoryRows(resolveToriiSqlUrl(cartridgeApiBase), query, { timeoutMs: 10_000 });
}

export async function findGameRegistryById(
  gameId: number,
  cartridgeApiBase?: string,
): Promise<AppchainGameRegistryRow | null> {
  const rows = await fetchRows(
    `SELECT * FROM ${GAME_REGISTRY_TABLE} WHERE game_id = ${gameId} LIMIT 1`,
    cartridgeApiBase,
  );
  return rows[0] ? toGameRegistryRow(rows[0]) : null;
}

export async function findGameRegistryByName(
  gameName: string,
  cartridgeApiBase?: string,
): Promise<AppchainGameRegistryRow | null> {
  const rows = await fetchRows(`SELECT * FROM ${GAME_REGISTRY_TABLE} ORDER BY game_id DESC LIMIT 50`, cartridgeApiBase);
  const row = rows.find((candidate) => rowMatchesGameName(candidate, gameName));
  return row ? toGameRegistryRow(row) : null;
}

export async function waitForGameRegistryById(params: {
  gameId: number;
  cartridgeApiBase?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onRetry?: (attempt: number, elapsedMs: number) => void;
}): Promise<AppchainGameRegistryRow> {
  const timeoutMs = params.timeoutMs ?? 120_000;
  const pollIntervalMs = params.pollIntervalMs ?? 2_000;
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt <= timeoutMs) {
    attempt += 1;
    const row = await findGameRegistryById(params.gameId, params.cartridgeApiBase).catch(() => null);
    if (row) {
      return row;
    }
    params.onRetry?.(attempt, Date.now() - startedAt);
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for s2_blitz-GameRegistry row ${params.gameId}`);
}

export async function isChainConfigInitialized(cartridgeApiBase?: string): Promise<boolean> {
  return (await fetchRows(`SELECT * FROM ${CHAIN_CONFIG_TABLE} LIMIT 1`, cartridgeApiBase)).length > 0;
}

export async function isPresetRegistered(presetId: number, cartridgeApiBase?: string): Promise<boolean> {
  return (
    (await fetchRows(`SELECT * FROM ${PRESET_TABLE} WHERE preset_id = ${presetId} LIMIT 1`, cartridgeApiBase)).length >
    0
  );
}
