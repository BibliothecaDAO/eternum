/**
 * The release step of a deployment: a shard's running Frontier games advance to the release the deployed commit ships,
 * signed by the launcher, which alone may apply a release. The box half registers the release and has Herald publish
 * it; this step refuses until both are true, then advances each game one release at a time, waiting for each.
 */

import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";

/** What advancing reads and writes on the shard, as the launcher. */
export interface ReleaseChain {
  currentRelease(): Promise<number>;
  gameRelease(gameId: number): Promise<number>;
  isSettled(gameId: number): Promise<boolean>;
  /** Applies `releaseId` to the game, waits for its receipt, and returns the transaction hash. */
  applyRelease(gameId: number, releaseId: number): Promise<string>;
}

/** Herald's public manifest for the shard: the schema each release it can decode maps to. */
export type PublishedReleases = Pick<ShardManifest, "releaseSchemas">;

export interface AdvancedGame {
  gameId: number;
  from: number;
  to: number;
  transactions: string[];
}

export interface ShardRelease {
  chainId: string;
  releaseId: number;
  games: AdvancedGame[];
}

/** `POST /api/factory/release`: the release the deployed commit ships. */
export interface ApplyReleaseRequest {
  releaseId: number;
}

/** What the route answers: every active shard, and each of its running Frontier games before and after. */
export interface ReleaseReport {
  releaseId: number;
  shards: ShardRelease[];
}

/** The refusals the route reports by name; anything else is an unexpected failure. */
export const RELEASE_REFUSALS = [
  "release_not_registered",
  "release_older_than_shard",
  "release_unpublished",
  "release_downgrade",
] as const;

export const isReleaseId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 0xffffffff;

export async function advanceGames(
  chain: ReleaseChain,
  herald: PublishedReleases,
  gameIds: readonly number[],
  releaseId: number,
): Promise<AdvancedGame[]> {
  await requireRegistered(chain, releaseId);
  const pins = await runningGamePins(chain, gameIds);
  if (pins.some(({ releaseId: pin }) => pin > releaseId)) throw new Error("release_downgrade");
  requirePublished(herald, releaseId, pins);
  const advanced: AdvancedGame[] = [];
  for (const pin of pins) advanced.push(await advanceGame(chain, pin, releaseId));
  return advanced;
}

/** The shard's registered release is the one being deployed: the box half registers it first. */
async function requireRegistered(chain: ReleaseChain, releaseId: number) {
  const current = await chain.currentRelease();
  if (current < releaseId) throw new Error("release_not_registered");
  if (current > releaseId) throw new Error("release_older_than_shard");
}

async function runningGamePins(chain: ReleaseChain, gameIds: readonly number[]) {
  const pins: { gameId: number; releaseId: number }[] = [];
  for (const gameId of gameIds)
    if (!(await chain.isSettled(gameId))) pins.push({ gameId, releaseId: await chain.gameRelease(gameId) });
  return pins;
}

/** Every release from the oldest pin up decodes with the release's own schema, or a game would leave its clients. */
function requirePublished(herald: PublishedReleases, releaseId: number, pins: readonly { releaseId: number }[]) {
  const schema = herald.releaseSchemas[String(releaseId)];
  const first = Math.min(releaseId, ...pins.map((pin) => pin.releaseId));
  for (let release = first; release <= releaseId; release++)
    if (!schema || herald.releaseSchemas[String(release)] !== schema) throw new Error("release_unpublished");
}

async function advanceGame(
  chain: ReleaseChain,
  { gameId, releaseId: from }: { gameId: number; releaseId: number },
  releaseId: number,
): Promise<AdvancedGame> {
  const transactions: string[] = [];
  for (let next = from + 1; next <= releaseId; next++) transactions.push(await chain.applyRelease(gameId, next));
  return { gameId, from, to: releaseId, transactions };
}
