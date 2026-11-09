import { isShareChannel, isShareKind } from "@realms-world/identity";
import type { ShareChannel, ShareMoment } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { keepBrowser } from "./browsers";
import { readCampaignCode } from "./campaigns";
import { accountKey } from "./campaign-entry";
import { json } from "./http";
import { createShareStore } from "./share-store";
import type { PendingJoin } from "./share-store";

/** What share settlement reads beyond D1: each game's season board, and the account each Realms id plays with. */
export interface ShareWorld {
  db: D1Database;
  sitesCleared: (game: { chainId: string; gameId: number }) => Promise<Map<string, number> | null>;
  accountOf: (realmsId: string) => Promise<string>;
}

/** How many sharers the operator's report ranks. */
const TOP_SHARERS = 20;
/** The largest day a moment may name: a season is far shorter, so anything above is no moment of ours. */
const MOMENT_LIMIT = 10_000;

/** POST /api/shares: the signed-in account's link for one moment (a Frontier day), made once and the same after. */
export async function handleCreateShare(request: Request, auth: IdentityAuth, db: D1Database) {
  const sharer = await signedInRealmsId(request, auth);
  if (typeof sharer !== "string") return sharer;
  const moment = readShareMoment(await request.json().catch(() => null));
  if (!moment) return json({ error: "invalid_share" }, 400);
  return json({ code: await createShareStore(db).linkFor(sharer, moment, nowSeconds()) });
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
  return Response.json({ kind: shared.kind, moment: shared.moment, name: shared.name }, { headers });
}

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

/**
 * Settles what shared links brought: new accounts become joins of the link their browser opened first, then each join
 * (every sharer's, or one sharer's) counts as activated once its link's season board shows it with a site cleared. The
 * board is the window: a site cleared there was cleared in the season the link was shared from, however late it is
 * read. Every step is safe to repeat, so any read may settle; a board that cannot answer leaves its joins for the next.
 */
async function settleShares(world: ShareWorld, now: number, sharer?: string) {
  const store = createShareStore(world.db);
  await store.settleJoins();
  const pending = await store.pendingJoins(sharer);
  let unsettled = 0;
  const activated: string[] = [];
  for (const [game, joins] of joinsByGame(pending)) {
    const board = await world.sitesCleared(game);
    if (board === null) unsettled += joins.length;
    else activated.push(...(await friendsWithAClear(world, joins, board)));
  }
  await store.markActivated(activated, now);
  return { unsettled };
}

/** The joins the season board shows with at least one site cleared. */
const friendsWithAClear = async (world: ShareWorld, joins: readonly PendingJoin[], board: Map<string, number>) => {
  const cleared: string[] = [];
  for (const join of joins)
    if ((board.get(accountKey(await world.accountOf(join.friend))) ?? 0) >= 1) cleared.push(join.friend);
  return cleared;
};

/** Pending joins grouped by the game whose board decides them, so each board is read once. */
const joinsByGame = (joins: readonly PendingJoin[]) => {
  const games = new Map<string, { game: { chainId: string; gameId: number }; joins: PendingJoin[] }>();
  for (const join of joins) {
    const key = `${join.chainId}:${join.gameId}`;
    const entry = games.get(key) ?? { game: { chainId: join.chainId, gameId: join.gameId }, joins: [] };
    entry.joins.push(join);
    games.set(key, entry);
  }
  return [...games.values()].map(({ game, joins: grouped }) => [game, grouped] as const);
};

/** A moment as the share sheet sends it; null for anything else. The chain is kept in one spelling, lowercase hex. */
const readShareMoment = (body: unknown): ShareMoment | null => {
  if (!body || typeof body !== "object") return null;
  const { kind, chainId, gameId, moment } = body as Record<string, unknown>;
  if (
    !isShareKind(kind) ||
    !isWholeBetween(gameId, 0, Number.MAX_SAFE_INTEGER) ||
    !isWholeBetween(moment, 1, MOMENT_LIMIT)
  )
    return null;
  const chain = chainSpelling(chainId);
  return chain ? { kind, chainId: chain, gameId, moment } : null;
};

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
