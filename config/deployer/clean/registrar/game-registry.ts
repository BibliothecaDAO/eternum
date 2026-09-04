import { setTimeout as sleep } from "node:timers/promises";

export interface GameRegistryRow extends Record<string, unknown> {
  gameId: number;
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
