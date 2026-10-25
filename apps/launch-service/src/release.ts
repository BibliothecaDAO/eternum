/**
 * The release step of a deployment: a shard's running Frontier games advance to the release the deployed commit ships,
 * signed by the launcher, which alone may apply a release. The box half registers the release and has Herald publish
 * it; this step refuses until the shard's registered release is the commit's, contents included, and Herald maps every
 * release a game moves through to the commit's schema. Then it advances each game one release at a time.
 */

import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";

/** What advancing reads and writes on the shard, as the launcher. */
export interface ReleaseChain {
  currentRelease(): Promise<number>;
  /** The logic and migration classes registered under `releaseId`, as hex strings. */
  registeredRelease(releaseId: number): Promise<{ logic: Record<string, string>; migration: string }>;
  /** The game the launcher created under `name`, or 0 when none exists. */
  gameId(name: string): Promise<number>;
  gameRelease(gameId: number): Promise<number>;
  isSettled(gameId: number): Promise<boolean>;
  /** Applies `releaseId` to the game, waits for its receipt, and returns the transaction hash. */
  applyRelease(gameId: number, releaseId: number): Promise<string>;
}

/** Herald's public manifest for the shard: the schema each release it can decode maps to. */
export type PublishedReleases = Pick<ShardManifest, "releaseSchemas">;

/** A release as the deployed commit's box build baked it: its id, schema, and logic and migration classes. */
export interface ReleaseIdentity {
  releaseId: number;
  schema: string;
  logic: Record<string, string>;
  migration: string;
}

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

/**
 * `POST /api/factory/release`: the release the deployed commit ships. Null when the box half has never built, which
 * only a deployment with no active shard yet may send.
 */
export interface ApplyReleaseRequest {
  release: ReleaseIdentity | null;
}

/** What the route answers: every active shard, and each of its running Frontier games before and after. */
export interface ReleaseReport {
  shards: ShardRelease[];
}

/** The refusals the route reports by name; anything else is an unexpected failure. */
export const RELEASE_REFUSALS = [
  "release_unverified",
  "release_not_registered",
  "release_older_than_shard",
  "release_contents_differ",
  "release_unpublished",
  "release_downgrade",
] as const;

const isFelt = (value: unknown): value is string => typeof value === "string" && /^0x[0-9a-f]{1,64}$/i.test(value);

export const isReleaseIdentity = (value: unknown): value is ReleaseIdentity => {
  const release = value as Partial<ReleaseIdentity> | null;
  return (
    typeof release?.releaseId === "number" &&
    Number.isSafeInteger(release.releaseId) &&
    release.releaseId >= 1 &&
    release.releaseId <= 0xffffffff &&
    typeof release.schema === "string" &&
    /^[0-9a-f]{64}$/.test(release.schema) &&
    isFelt(release.migration) &&
    typeof release.logic === "object" &&
    release.logic !== null &&
    Object.keys(release.logic).length > 0 &&
    Object.values(release.logic).every(isFelt)
  );
};

/**
 * Advances every running game among `gameNames` (the Frontier games the launch service created or may have created,
 * whatever their launch run's state) to `release`. Every check reads before anything is sent.
 */
export async function advanceGames(
  chain: ReleaseChain,
  herald: PublishedReleases,
  release: ReleaseIdentity,
  gameNames: readonly string[],
): Promise<AdvancedGame[]> {
  await requireRegistered(chain, release);
  const pins = await runningGamePins(chain, gameNames);
  if (pins.some(({ releaseId }) => releaseId > release.releaseId)) throw new Error("release_downgrade");
  requirePublished(herald, release, pins);
  const advanced: AdvancedGame[] = [];
  for (const pin of pins) advanced.push(await advanceGame(chain, pin, release.releaseId));
  return advanced;
}

/** The shard's registered release is the commit's, number and contents: the box half registers it first. */
async function requireRegistered(chain: ReleaseChain, release: ReleaseIdentity) {
  const current = await chain.currentRelease();
  if (current < release.releaseId) throw new Error("release_not_registered");
  if (current > release.releaseId) throw new Error("release_older_than_shard");
  if (!sameContents(await chain.registeredRelease(release.releaseId), release))
    throw new Error("release_contents_differ");
}

function sameContents(registered: { logic: Record<string, string>; migration: string }, release: ReleaseIdentity) {
  const names = new Set([...Object.keys(registered.logic), ...Object.keys(release.logic)]);
  return (
    [...names].every((name) => sameFelt(registered.logic[name], release.logic[name])) &&
    sameFelt(registered.migration, release.migration)
  );
}

const sameFelt = (left: string | undefined, right: string | undefined) =>
  left !== undefined && right !== undefined && BigInt(left) === BigInt(right);

/**
 * A launch run names its game before creating it, and a launch interrupted after creating it may not have recorded it
 * yet, so each name is resolved on the chain: a game that exists is advanced, a name never created is skipped.
 */
async function runningGamePins(chain: ReleaseChain, gameNames: readonly string[]) {
  const pins: { gameId: number; releaseId: number }[] = [];
  for (const name of gameNames) {
    const gameId = await chain.gameId(name);
    if (gameId && !(await chain.isSettled(gameId))) pins.push({ gameId, releaseId: await chain.gameRelease(gameId) });
  }
  return pins;
}

/** Herald decodes every release from the oldest pin up with the commit's schema, or a game would leave its clients. */
function requirePublished(herald: PublishedReleases, release: ReleaseIdentity, pins: readonly { releaseId: number }[]) {
  const first = Math.min(release.releaseId, ...pins.map((pin) => pin.releaseId));
  for (let releaseId = first; releaseId <= release.releaseId; releaseId++)
    if (herald.releaseSchemas[String(releaseId)] !== release.schema) throw new Error("release_unpublished");
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
