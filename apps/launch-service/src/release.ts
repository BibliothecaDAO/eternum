/**
 * The release step of a deployment: running Frontier games on supported presets advance to the deployed release,
 * signed by the launcher, which alone may apply a release. The box half registers the release and has Herald publish
 * it; this step refuses until the shard's registered release is the commit's, contents included, and Herald maps every
 * release a game moves through to the commit's schema. Then it advances each game one release at a time.
 */

import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";
import type { RegisteredShard } from "@realms-world/value-ledger";

/** What advancing reads and writes on the shard, as the launcher. */
export interface ReleaseChain {
  openReleaseOf(family: number): Promise<number>;
  latestReleaseOf(family: number): Promise<number>;
  releaseRegistered(releaseId: number): Promise<boolean>;
  /** The logic and migration classes registered under `releaseId`, as hex strings. */
  registeredRelease(releaseId: number): Promise<RegisteredRelease>;
  /** The game the launcher created under `name`, or 0 when none exists. */
  gameId(name: string): Promise<number>;
  gameRelease(gameId: number): Promise<number>;
  game(gameId: number): Promise<{ settled: boolean; family: bigint }>;
  /** Applies `releaseId` to the game, waits for its receipt, and returns the transaction hash. */
  applyRelease(gameId: number, releaseId: number): Promise<string>;
  openRelease(releaseId: number): Promise<string>;
}

export interface RegisteredRelease {
  family: number;
  previous: number;
  logic: string[];
  migration: string;
}

/** Herald's public manifest for the shard: the schema each release it can decode maps to. */
export type PublishedReleases = Pick<ShardManifest, "releases">;

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
  opened: string[];
}

/**
 * `POST /api/factory/release`: the release the deployed commit ships. Null when the box half has never built, which
 * only a deployment with no active shard yet may send.
 */
export interface ApplyReleaseRequest {
  release: ReleaseIdentity | null;
  shard: RegisteredShard | null;
}

export interface ReleaseReport {
  shard: ShardRelease | null;
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

export const isRegisteredShard = (value: unknown): value is RegisteredShard =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RegisteredShard).chainId === "string" &&
  typeof (value as RegisteredShard).url === "string";

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
 * Advances supported running games among `gameNames` (the Frontier games the launch service created or may have created,
 * whatever their launch run's state) to `release`. Every check reads before anything is sent.
 */
export async function advanceGames(
  chain: ReleaseChain,
  herald: PublishedReleases,
  release: ReleaseIdentity,
  gameNames: readonly string[],
): Promise<AdvancedGame[]> {
  const { family } = await requireRegistered(chain, release);
  const plans = [];
  for (const pin of await runningGamePins(chain, gameNames, family))
    plans.push({ ...pin, line: await releasesAfter(chain, release.releaseId, pin.releaseId) });
  requirePublished(
    herald,
    release,
    plans.flatMap(({ releaseId, line }) => [releaseId, ...line]),
  );
  const advanced: AdvancedGame[] = [];
  for (const plan of plans) advanced.push(await advanceGame(chain, plan, release.releaseId));
  return advanced;
}

export async function openForNewGames(chain: ReleaseChain, release: ReleaseIdentity): Promise<string[]> {
  const { family } = await chain.registeredRelease(release.releaseId);
  const transactions: string[] = [];
  for (const next of await releasesAfter(chain, release.releaseId, await chain.openReleaseOf(family)))
    transactions.push(await chain.openRelease(next));
  return transactions;
}

/** The shard's registered release is the commit's, number and contents: the box half registers it first. */
async function requireRegistered(chain: ReleaseChain, release: ReleaseIdentity) {
  if (!(await chain.releaseRegistered(release.releaseId))) throw new Error("release_not_registered");
  const registered = await chain.registeredRelease(release.releaseId);
  if ((await chain.latestReleaseOf(registered.family)) !== release.releaseId)
    throw new Error("release_older_than_shard");
  if (!sameContents(registered, release)) throw new Error("release_contents_differ");
  return registered;
}

async function releasesAfter(chain: ReleaseChain, releaseId: number, from: number) {
  const line: number[] = [];
  for (let id = releaseId; id !== from; id = (await chain.registeredRelease(id)).previous) {
    if (id === 0) throw new Error("release_downgrade");
    line.unshift(id);
  }
  return line;
}

function sameContents(registered: RegisteredRelease, release: ReleaseIdentity) {
  const logic = Object.values(release.logic);
  return (
    registered.logic.length === logic.length &&
    logic.every((classHash, slot) => sameFelt(registered.logic[slot], classHash)) &&
    sameFelt(registered.migration, release.migration)
  );
}

const sameFelt = (left: string | undefined, right: string | undefined) =>
  left !== undefined && right !== undefined && BigInt(left) === BigInt(right);

async function runningGamePins(chain: ReleaseChain, gameNames: readonly string[], family: number) {
  const pins: { gameId: number; releaseId: number }[] = [];
  for (const name of gameNames) {
    const gameId = await chain.gameId(name);
    if (!gameId) continue;
    const game = await chain.game(gameId);
    if (!game.settled && Number(game.family) === family)
      pins.push({ gameId, releaseId: await chain.gameRelease(gameId) });
  }
  return pins;
}

/** Herald decodes every release from the oldest pin up with the commit's schema, or a game would leave its clients. */
function requirePublished(herald: PublishedReleases, release: ReleaseIdentity, releaseIds: readonly number[]) {
  for (const releaseId of [release.releaseId, ...releaseIds])
    if (herald.releases[String(releaseId)]?.schema !== release.schema) throw new Error("release_unpublished");
}

async function advanceGame(
  chain: ReleaseChain,
  { gameId, releaseId: from, line }: { gameId: number; releaseId: number; line: readonly number[] },
  releaseId: number,
): Promise<AdvancedGame> {
  const transactions: string[] = [];
  for (const next of line) transactions.push(await chain.applyRelease(gameId, next));
  return { gameId, from, to: releaseId, transactions };
}
