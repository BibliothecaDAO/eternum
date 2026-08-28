import { setTimeout as sleep } from "node:timers/promises";

export interface GameRegistryRow extends Record<string, unknown> {
  gameId: number;
}

const GAME_REGISTRY_TABLE = '"s2-GameRegistry"';
const CHAIN_CONFIG_TABLE = '"s2-ChainConfig"';
const PRESET_TABLE = '"s2-Preset"';

function resolveToriiSqlUrl(providedUrl?: string): string {
  const toriiUrl = providedUrl || process.env.TORII_SQL_URL || process.env.TORII_URL;
  if (!toriiUrl) {
    throw new Error("TORII_URL or TORII_SQL_URL is required for indexing checks");
  }
  const normalized = toriiUrl.replace(/\/+$/, "");
  return normalized.endsWith("/sql") ? normalized : `${normalized}/sql`;
}

interface HeraldDirectoryTarget {
  chain: string;
  heraldUrl?: string;
}

function resolveHeraldDirectoryUrl(target: HeraldDirectoryTarget): string {
  const baseUrl = target.heraldUrl || process.env.HERALD_URL || process.env.VITE_PUBLIC_HERALD_URL;
  if (!baseUrl) throw new Error("HERALD_URL is required for GameRegistry checks");
  const url = new URL(baseUrl);
  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}/${target.chain}/games`;
  url.search = "";
  return url.toString();
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
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

function toGameRegistryRow(row: Record<string, unknown>): GameRegistryRow | null {
  const gameId = readGameId(row);
  return gameId ? { ...row, gameId } : null;
}

async function fetchToriiRows(query: string, toriiSqlUrl?: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${resolveToriiSqlUrl(toriiSqlUrl)}?query=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Torii query failed: ${response.status} ${response.statusText}`);
  }
  const rows = (await response.json()) as unknown;
  if (!Array.isArray(rows)) {
    throw new Error("Torii query returned an unexpected payload");
  }
  return rows as Record<string, unknown>[];
}

async function fetchGameDirectory(target: HeraldDirectoryTarget): Promise<GameRegistryRow[]> {
  const response = await fetch(resolveHeraldDirectoryUrl(target), { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Herald directory failed: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { games?: unknown };
  if (!Array.isArray(payload.games)) throw new Error("Herald directory returned an unexpected payload");
  return payload.games.flatMap((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) return [];
    const parsed = toGameRegistryRow(row as Record<string, unknown>);
    return parsed ? [parsed] : [];
  });
}

export const findGameRegistryById = async (
  gameId: number,
  target: HeraldDirectoryTarget,
): Promise<GameRegistryRow | null> => (await fetchGameDirectory(target)).find((row) => row.gameId === gameId) ?? null;

export const findGameRegistryByName = async (
  gameName: string,
  target: HeraldDirectoryTarget,
): Promise<GameRegistryRow | null> => (await fetchGameDirectory(target)).find((row) => row.name === gameName) ?? null;

export async function waitForGameRegistryById(params: {
  gameId: number;
  chain: string;
  heraldUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onRetry?: (attempt: number, elapsedMs: number) => void;
}): Promise<GameRegistryRow> {
  const timeoutMs = params.timeoutMs ?? 120_000;
  const pollIntervalMs = params.pollIntervalMs ?? 2_000;
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt <= timeoutMs) {
    attempt += 1;
    const row = await findGameRegistryById(params.gameId, params).catch(() => null);
    if (row) return row;
    params.onRetry?.(attempt, Date.now() - startedAt);
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Herald GameRegistry row ${params.gameId}`);
}

export async function isChainConfigInitialized(toriiSqlUrl?: string): Promise<boolean> {
  return (await fetchToriiRows(`SELECT * FROM ${CHAIN_CONFIG_TABLE} LIMIT 1`, toriiSqlUrl)).length > 0;
}

export async function isPresetRegistered(presetId: number, toriiSqlUrl?: string): Promise<boolean> {
  return (
    (await fetchToriiRows(`SELECT * FROM ${PRESET_TABLE} WHERE preset_id = ${presetId} LIMIT 1`, toriiSqlUrl)).length >
    0
  );
}
