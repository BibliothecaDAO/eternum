import type { HeraldGameDirectory, HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";

import type { WorldDeployment } from "./world-directory";

const buildHeraldUrl = (world: WorldDeployment, pathname: string): string => {
  const url = new URL(world.heraldBaseUrl);
  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}/${world.chain}${pathname}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const fetchHeraldJson = async <Payload>(url: string, description: string): Promise<Payload> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${description} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Payload;
};

export const fetchHeraldGameDirectory = async (
  world: WorldDeployment,
  playerAddress?: string,
): Promise<HeraldGameDirectory> => {
  const url = new URL(buildHeraldUrl(world, "/games"));
  if (playerAddress) url.searchParams.set("player", playerAddress);
  return fetchHeraldJson(url.toString(), `Herald directory for ${world.id}`);
};

export const fetchHeraldGameSnapshot = async (
  world: WorldDeployment,
  gameId: number,
  models: readonly string[],
): Promise<HeraldGameSnapshot> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald snapshot requires a positive game id; received ${gameId}`);
  }
  if (models.length === 0) throw new Error("Herald snapshot requires at least one model");

  const url = new URL(buildHeraldUrl(world, `/games/${gameId}/snapshot`));
  url.searchParams.set("models", [...new Set(models)].join(","));
  return fetchHeraldJson(url.toString(), `Herald snapshot for ${world.id} game ${gameId}`);
};

export const snapshotModelRows = (snapshot: HeraldGameSnapshot, model: string): Array<Record<string, unknown>> => {
  const selected = snapshot.models.find((entry) => entry.model === model);
  if (!selected) throw new Error(`Herald snapshot omitted requested model ${model}`);
  return selected.rows.map((row) => row.value);
};

export const feltEquals = (left: unknown, right: unknown): boolean => {
  try {
    return BigInt(left as string | number | bigint) === BigInt(right as string | number | bigint);
  } catch {
    return false;
  }
};
