import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { CampaignTicketStore } from "./campaign-ticket-store";
import { createCampaignReferralStore } from "./campaign-referral-store";
import { CAMPAIGNS, isCampaignKey, type CampaignKey } from "@realms-world/identity";

import { campaignCodeHash, readCampaignCode } from "./campaigns";
import { json, readBody } from "./http";

const REDEEM_BYTES = 1024;

/**
 * POST /api/campaigns/redeem: the signed-in account takes its ticket to a campaign from the code its flyer carried, or
 * from a friend's referral link: a printed flyer's own ticket; for a code every flyer shares, one of the campaign's
 * unspent printed tickets drawn at random, or a regular one once none is left; for a referral link, a regular ticket,
 * recording the friend for their inviter. It answers the ticket's tier, to this account only; repeating it answers the
 * same ticket, so a reload or a retry never shows another outcome, with a code or without. Without a code it first
 * settles what the account's own friends earned it, so a ticket they earned is there to found or attach with. A code
 * another account already took, or one no flyer carries, gives none; an account whose home already has a source in the
 * campaign's running game is refused and nothing is spent.
 */
export function handleCampaignRedeem(
  request: Request,
  auth: IdentityAuth,
  db: D1Database,
  world: { hasSource: CampaignHomeSource; settle: SettleReferrals },
): Promise<Response> {
  return campaignResponse(db, redeemTicket(request, auth, db, world));
}

/** Pays what the account's friends earned it; a failure only leaves it for a later read. */
type SettleReferrals = (realmsId: string, campaign: CampaignKey) => Promise<unknown>;

/** Whether the account already has a home source in a running campaign game; null when unknown. */
type CampaignHomeSource = (realmsId: string, presets: readonly number[]) => Promise<boolean | null>;

/** Operator recovery draws as a shared flyer does, with the same eligibility check. */
export function handleCampaignDraw(request: Request, db: D1Database, hasSource: CampaignHomeSource) {
  return campaignResponse(db, drawTicket(request, db, hasSource));
}

function campaignResponse(db: D1Database, operation: ReturnType<typeof redeemTicket>) {
  return Effect.runPromise(
    operation.pipe(
      Effect.provide(CampaignTicketStore.layer(db)),
      Effect.catchTag("CampaignStorageError", () => Effect.succeed(json({ error: "campaigns_unavailable" }, 503))),
      Effect.catchTag("CampaignRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );
}

function drawTicket(request: Request, db: D1Database, hasSource: CampaignHomeSource) {
  return Effect.gen(function* () {
    const asked = yield* Effect.tryPromise({
      try: () => readOperatorDraw(request),
      catch: () => new CampaignRequestError({ code: "invalid_redemption", status: 400 }),
    });
    const exists = yield* Effect.tryPromise({
      try: () => db.prepare('SELECT id FROM "user" WHERE "realmsId" = ?').bind(asked.realmsId).first(),
      catch: () => new CampaignRequestError({ code: "campaigns_unavailable", status: 503 }),
    });
    if (!exists) return json({ error: "account_unavailable" }, 404);
    const store = yield* CampaignTicketStore;
    const held = yield* store.read(asked.campaign, asked.realmsId);
    if (held) return json({ campaign: held.campaign, tier: held.tier });
    const now = Math.floor(Date.now() / 1000);
    if (now >= CAMPAIGNS[asked.campaign].redeemUntil) return json({ error: "campaign_closed" }, 410);
    const refusal = yield* sourceRefusal(asked.realmsId, asked.campaign, hasSource);
    if (refusal) return refusal;
    const ticket = yield* store.draw(asked.campaign, asked.realmsId, now);
    return json({ campaign: ticket.campaign, tier: ticket.tier });
  });
}

async function readOperatorDraw(request: Request): Promise<{ campaign: CampaignKey; realmsId: string }> {
  const body = JSON.parse(await readBody(request, REDEEM_BYTES));
  if (
    !isCampaignKey(body.campaign) ||
    typeof body.realmsId !== "string" ||
    !/^0x[0-9a-f]{1,64}$/i.test(body.realmsId) ||
    Object.keys(body).sort().join() !== "campaign,realmsId"
  )
    throw new Error("invalid_redemption");
  return body;
}

function sourceRefusal(realmsId: string, campaign: CampaignKey, hasSource: CampaignHomeSource) {
  return Effect.gen(function* () {
    const sourced = yield* Effect.tryPromise({
      try: () => hasSource(realmsId, CAMPAIGNS[campaign].presets),
      catch: () => new CampaignRequestError({ code: "campaigns_unavailable", status: 503 }),
    });
    if (sourced === null) return json({ error: "campaigns_unavailable" }, 503);
    return sourced ? json({ error: "realm_founded" }, 409) : null;
  });
}

function redeemTicket(
  request: Request,
  auth: IdentityAuth,
  db: D1Database,
  { hasSource, settle }: { hasSource: CampaignHomeSource; settle: SettleReferrals },
) {
  return Effect.gen(function* () {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new CampaignRequestError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const asked = yield* Effect.tryPromise({
      try: async () => readRedemption(JSON.parse(await readBody(request, REDEEM_BYTES))),
      catch: () => new CampaignRequestError({ code: "invalid_redemption", status: 400 }),
    });
    if (!asked) return json({ error: "invalid_redemption" }, 400);
    const realmsId = session.user.realmsId;
    if (asked.kind === "held") yield* Effect.promise(() => settle(realmsId, asked.campaign).catch(() => undefined));
    const now = Math.floor(Date.now() / 1000);
    const store = yield* CampaignTicketStore;
    const held = yield* store.read(asked.campaign, realmsId);
    if (!held && now >= CAMPAIGNS[asked.campaign].redeemUntil) return json({ error: "campaign_closed" }, 410);
    if (held) return json({ campaign: held.campaign, tier: held.tier });
    if (asked.kind === "held") return json({ error: "invalid_redemption" }, 400);
    return yield* asked.kind === "flyer"
      ? openFlyerTicket(realmsId, { campaign: asked.campaign, code: asked.code }, now, hasSource)
      : openReferralTicket(db, realmsId, { campaign: asked.campaign, referral: asked.code }, now, hasSource);
  });
}

/**
 * A new ticket from a flyer's code: refused while another account holds the code, and, so nothing is spent for someone
 * else, while this account already has a home source in the campaign's running game.
 */
function openFlyerTicket(
  realmsId: string,
  { campaign, code }: { campaign: CampaignKey; code: string },
  now: number,
  hasSource: CampaignHomeSource,
) {
  return Effect.gen(function* () {
    const store = yield* CampaignTicketStore;
    const codeHash = yield* Effect.promise(() => campaignCodeHash(campaign, code));
    const source = yield* store.source(campaign, codeHash);
    if (!source) return json({ error: "ticket_taken" }, 410);
    const refusal = yield* sourceRefusal(realmsId, campaign, hasSource);
    if (refusal) return refusal;
    const ticket = yield* source.kind === "shared"
      ? store.draw(campaign, realmsId, now)
      : store.redeem(campaign, realmsId, codeHash, source.tier, now);
    if (!ticket) return json({ error: "ticket_taken" }, 410);
    return json({ campaign: ticket.campaign, tier: ticket.tier });
  });
}

/**
 * A friend's regular ticket from their inviter's referral link, given whatever the printed codes, and recorded for the
 * inviter only when this link gave it. Refused for the inviter's own link, and, as a flyer is, while the account
 * already has a home source in the campaign's running game.
 */
function openReferralTicket(
  db: D1Database,
  realmsId: string,
  { campaign, referral }: { campaign: CampaignKey; referral: string },
  now: number,
  hasSource: CampaignHomeSource,
) {
  return Effect.gen(function* () {
    const referrals = createCampaignReferralStore(db);
    const inviter = yield* campaignStorage(() => referrals.inviterOf(campaign, referral));
    if (!inviter) return json({ error: "referral_unknown" }, 404);
    if (inviter.referrer === realmsId) return json({ error: "self_referral" }, 409);
    const refusal = yield* sourceRefusal(realmsId, campaign, hasSource);
    if (refusal) return refusal;
    const { ticket, given } = yield* (yield* CampaignTicketStore).giveFriend(campaign, realmsId, now);
    if (given) yield* campaignStorage(() => referrals.record(campaign, realmsId, inviter.referrer, now));
    return json({ campaign: ticket.campaign, tier: ticket.tier });
  });
}

const campaignStorage = <T>(read: () => Promise<T>) =>
  Effect.tryPromise({
    try: read,
    catch: () => new CampaignRequestError({ code: "campaigns_unavailable", status: 503 }),
  });

/**
 * A redemption names its campaign, and the code its flyer carried or the code of a friend's referral link, never both.
 * Without either it can only answer a ticket the account already holds; a code no flyer or link could carry counts as
 * none.
 */
const readRedemption = (
  value: unknown,
):
  | { campaign: CampaignKey; kind: "held" }
  | { campaign: CampaignKey; kind: "flyer" | "referral"; code: string }
  | null => {
  const body = (value ?? {}) as Record<string, unknown>;
  if (!isCampaignKey(body.campaign)) return null;
  if (body.referral !== undefined && body.code !== undefined && body.code !== null) return null;
  const referral = readCampaignCode(body.referral);
  if (referral) return { campaign: body.campaign, kind: "referral", code: referral };
  const code = readCampaignCode(body.code);
  return code ? { campaign: body.campaign, kind: "flyer", code } : { campaign: body.campaign, kind: "held" };
};

class CampaignRequestError extends Data.TaggedError("CampaignRequestError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
