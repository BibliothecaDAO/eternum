import { aspects, catalogAspectId, FRIEND_GLORY, type AspectId } from "@bibliothecadao/types";
import { isShareChannel, isShareKind } from "@realms-world/identity";
import type { ShareChannel, ShareMoment } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { keepBrowser } from "./browsers";
import { readCampaignCode } from "./campaigns";
import { aspectOn } from "./account-aspect";
import { accountKey, gloryOn, playerAccounts } from "./campaign-entry";
import type { IdentityEnv } from "./env";
import { creditFragmentsOf } from "./fragment-credit";
import { json } from "./http";
import { intendedAspect, inviteSide } from "./order-intent";
import { createShareStore } from "./share-store";
import { openFrontierGames } from "./shop-game";
import type { PendingJoin, ShareGame, SharedLink, SharePayout } from "./share-store";

export interface ShareWorld {
  db: D1Database;
  glory: (game: ShareGame) => Promise<Map<string, number> | null>;
  seasonGames: () => Promise<ShareGame[]>;
  aspectOf: (game: ShareGame, account: string) => Promise<AspectId | null>;
  accountOf: (realmsId: string) => Promise<string>;
  creditFragments: (payout: SharePayout) => Promise<Response>;
}

export const shareWorldOf = (
  env: Pick<IdentityEnv, "DB" | "GUARDIAN" | "VALUE_RELAY" | "OPERATOR_TOKEN">,
  fetchShard: typeof fetch,
): ShareWorld => ({
  db: env.DB,
  glory: (game) => gloryOn(env, fetchShard, game),
  seasonGames: () => openFrontierGames(env, fetchShard, Math.floor(Date.now() / 1000)),
  aspectOf: (game, account) => aspectOn(env, fetchShard, game, account),
  accountOf: playerAccounts(env),
  creditFragments: (payout) => creditFragmentsOf(env)(payout),
});

/** How many sharers the operator's report ranks. */
const TOP_SHARERS = 20;
/** The largest day a moment may name: a season is far shorter, so anything above is no moment of ours. */
const MOMENT_LIMIT = 10_000;

/**
 * POST /api/shares: the signed-in account's link for one moment (a Frontier day, or an invite to its Aspect), made
 * once and the same after. An invite names only the Aspect its sharer plays for in that game, as its Herald says.
 */
export async function handleCreateShare(request: Request, auth: IdentityAuth, world: ShareWorld) {
  const sharer = await signedInRealmsId(request, auth);
  if (typeof sharer !== "string") return sharer;
  const moment = readShareMoment(await request.json().catch(() => null));
  if (!moment) return json({ error: "invalid_share" }, 400);
  if (moment.kind === "aspect") {
    const refusal = await inviteRefusal(world, sharer, moment);
    if (refusal) return refusal;
  }
  return json({ code: await createShareStore(world.db).linkFor(sharer, moment, nowSeconds()) });
}

/** Why an invite cannot be made: Herald could not answer, or names another Aspect (or none) for its sharer. */
const inviteRefusal = async (world: ShareWorld, sharer: string, moment: ShareMoment): Promise<Response | null> => {
  let aspect: AspectId | null;
  try {
    aspect =
      moment.chainId === null
        ? await intendedAspect(world.db, sharer)
        : await world.aspectOf(moment, await world.accountOf(sharer));
  } catch {
    return json({ error: "aspect_unavailable" }, 503);
  }
  return aspect === moment.moment ? null : json({ error: "not_in_aspect" }, 403);
};

/** GET /api/shares/joined: the link the signed-in account came by, its joins settled first; null for none. */
export async function handleJoinedShare(request: Request, auth: IdentityAuth, db: D1Database) {
  const friend = await signedInRealmsId(request, auth);
  if (typeof friend !== "string") return friend;
  const store = createShareStore(db);
  await store.settleJoins();
  return json(await store.joinedLink(friend));
}

/** POST /api/shares/<code>/posted: the sharer opened the post with their link. */
export async function handleSharePosted(request: Request, auth: IdentityAuth, db: D1Database, code: string) {
  const sharer = await signedInRealmsId(request, auth);
  if (typeof sharer !== "string") return sharer;
  const link = readCampaignCode(code);
  if (!link || !(await createShareStore(db).markPosted(sharer, link, nowSeconds())))
    return json({ error: "share_unknown" }, 404);
  return new Response(null, { status: 204 });
}

/**
 * POST /api/shares/<code>/visit: a browser opened a shared link. The visit is kept against the browser's id (given
 * now, when it has none), the one thing that later ties an account made on it to the link, and with the channel the
 * link was posted from (`{ via }`); the answer says what the link shares and who shared it.
 */
export async function handleShareVisit(request: Request, db: D1Database, code: string) {
  const store = createShareStore(db);
  const link = readCampaignCode(code);
  const shared = link ? await store.sharedLink(link) : null;
  if (!link || !shared) return json({ error: "share_unknown" }, 404);
  const headers = new Headers({ "cache-control": "no-store" });
  await store.recordVisit(link, keepBrowser(request, headers), await visitChannel(request));
  return Response.json(await visitAnswer(db, shared), { headers });
}

const visitAnswer = async (db: D1Database, shared: SharedLink) => {
  const answer = { kind: shared.kind, moment: shared.moment, name: shared.name };
  if (shared.kind !== "aspect") return answer;
  if (shared.chainId !== null) return { ...answer, order: null, members: null };
  return { ...answer, ...(await inviteSide(db, shared.sharer, catalogAspectId(shared.moment))) };
};

/** GET /api/shares: what the signed-in account's links brought, its own joins settled first. */
export async function handleShareTally(request: Request, auth: IdentityAuth, world: ShareWorld) {
  const sharer = await signedInRealmsId(request, auth);
  if (typeof sharer !== "string") return sharer;
  await settleShares(world, nowSeconds(), sharer);
  return json(await createShareStore(world.db).tallyOf(sharer));
}

/** The channel a visit's body names; null for none, or one no player's link carries. */
const visitChannel = async (request: Request): Promise<ShareChannel | null> => {
  const { via } = ((await request.json().catch(() => null)) ?? {}) as { via?: unknown };
  return isShareChannel(via) ? via : null;
};

/**
 * GET /api/operator/shares: every moment's funnel, first visits by their link's tag and the sharers who brought the
 * most, every join settled first.
 */
export async function handleShareReport(world: ShareWorld) {
  const now = nowSeconds();
  const settled = await settleShares(world, now);
  const store = createShareStore(world.db);
  return json({
    settledAt: now,
    // Boards that could not answer leave their joins for the next read; the report says how many wait on them.
    unsettledJoins: settled.unsettled,
    moments: await store.momentReport(),
    firstVisitsByTag: await store.firstVisitsByTag(),
    topSharers: await store.topSharers(TOP_SHARERS),
  });
}

export async function settleShareInvites(world: ShareWorld) {
  const now = nowSeconds();
  const { games } = await settleShares(world, now);
  await deliverSharePayouts(world, games, now);
}

async function settleShares(world: ShareWorld, now: number, sharer?: string) {
  const store = createShareStore(world.db);
  await store.settleJoins();
  const pending = await store.pendingJoins(sharer);
  let games: ShareGame[];
  try {
    games = await world.seasonGames();
  } catch {
    return { unsettled: pending.length, games: [] };
  }
  const unsettled = new Set<string>();
  const activated = new Set<string>();
  for (const game of games) {
    const joins = pending.filter((join) => isDecidedIn(join, game) && !activated.has(join.friend));
    if (joins.length === 0) continue;
    const glory = await world.glory(game);
    if (glory === null) for (const join of joins) unsettled.add(join.friend);
    else
      for (const join of await friendsWithGlory(world, joins, glory)) {
        if (join.kind === "aspect") await store.recordFriendPayout(join, game, now);
        activated.add(join.friend);
      }
  }
  await store.markActivated([...activated], now);
  return { unsettled: [...unsettled].filter((friend) => !activated.has(friend)).length, games };
}

const isDecidedIn = (join: PendingJoin, game: ShareGame) =>
  join.chainId === null || (join.chainId === game.chainId && join.gameId === game.gameId);

const friendsWithGlory = async (world: ShareWorld, joins: readonly PendingJoin[], glory: Map<string, number>) => {
  const earned: PendingJoin[] = [];
  for (const join of joins)
    if ((glory.get(accountKey(await world.accountOf(join.friend))) ?? 0) >= FRIEND_GLORY) earned.push(join);
  return earned;
};

async function deliverSharePayouts(world: ShareWorld, games: readonly ShareGame[], now: number) {
  const store = createShareStore(world.db);
  for (const payout of await store.unpaidPayouts(games)) {
    try {
      if (!(await world.creditFragments(payout)).ok) throw new Error(`the relay refused payout ${payout.id}`);
      await store.markPaid(payout.id, now);
    } catch (error) {
      console.warn("[shares] an invite's Fragments wait for the next settle", payout.id, error);
    }
  }
}

/**
 * A moment as the share sheet sends it, a day or an Aspect by its kind; null for anything else. The chain is kept in
 * one spelling, lowercase hex.
 */
const readShareMoment = (body: unknown): ShareMoment | null => {
  if (!body || typeof body !== "object") return null;
  const { kind, chainId, gameId, moment } = body as Record<string, unknown>;
  if (!isShareKind(kind) || !isMomentOf(kind, moment)) return null;
  if (kind === "aspect" && chainId === null && gameId === null) return { kind, chainId, gameId, moment };
  if (!isWholeBetween(gameId, 0, Number.MAX_SAFE_INTEGER)) return null;
  const chain = chainSpelling(chainId);
  return chain ? { kind, chainId: chain, gameId, moment } : null;
};

/** A day of a season for a day's link; an Aspect of the catalog for an invite. */
const isMomentOf = (kind: ShareMoment["kind"], moment: unknown): moment is number =>
  kind === "aspect" ? aspects.some(({ id }) => id === moment) : isWholeBetween(moment, 1, MOMENT_LIMIT);

const isWholeBetween = (value: unknown, least: number, most: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= least && value <= most;

const chainSpelling = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) return null;
  return `0x${BigInt(value).toString(16)}`;
};

/** The signed-in account's Realms id, or the refusal to answer with. */
export const signedInRealmsId = async (request: Request, auth: IdentityAuth): Promise<string | Response> => {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => undefined);
  if (session === undefined) return json({ error: "authentication_unavailable" }, 503);
  return session?.user.realmsId ?? json({ error: "unauthorized" }, 401);
};

const nowSeconds = () => Math.floor(Date.now() / 1000);
