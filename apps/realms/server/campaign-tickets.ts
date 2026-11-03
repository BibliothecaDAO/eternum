import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { CampaignTicketStore } from "./campaign-ticket-store";
import { CAMPAIGNS, isCampaignKey, type CampaignKey } from "@realms-world/identity";

import { campaignCodeHash, readCampaignCode } from "./campaigns";
import { json, readBody } from "./http";

const REDEEM_BYTES = 1024;

/**
 * POST /api/campaigns/redeem: the signed-in account takes its ticket to a campaign from the code its flyer carried: a
 * printed flyer's own ticket, or, for a code every flyer shares, one of the campaign's unspent printed tickets drawn at
 * random. It answers the ticket's tier, to this account only; repeating it answers the same ticket, so a reload or a
 * retry never shows another outcome, with a code or without. A code another account already took, one no flyer carries,
 * or a shared code once every printed ticket is spent gives none; an account whose home already has a source in the
 * campaign's running game is refused and nothing is spent.
 */
export function handleCampaignRedeem(
  request: Request,
  auth: IdentityAuth,
  db: D1Database,
  hasSource: CampaignHomeSource,
): Promise<Response> {
  return campaignResponse(db, redeemTicket(request, auth, hasSource));
}

/** Whether the account already has a home source in a running campaign game; null when unknown. */
type CampaignHomeSource = (realmsId: string, presets: readonly number[]) => Promise<boolean | null>;

/** Operator recovery uses the same finite pool and eligibility check as a shared flyer. */
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
    return ticket ? json({ campaign: ticket.campaign, tier: ticket.tier }) : json({ error: "ticket_taken" }, 410);
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

function redeemTicket(request: Request, auth: IdentityAuth, hasSource: CampaignHomeSource) {
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
    const now = Math.floor(Date.now() / 1000);
    const store = yield* CampaignTicketStore;
    const held = yield* store.read(asked.campaign, session.user.realmsId);
    if (!held && now >= CAMPAIGNS[asked.campaign].redeemUntil) return json({ error: "campaign_closed" }, 410);
    if (held) return json({ campaign: held.campaign, tier: held.tier });
    if (asked.code === null) return json({ error: "invalid_redemption" }, 400);
    return yield* openFlyerTicket(
      session.user.realmsId,
      { campaign: asked.campaign, code: asked.code },
      now,
      hasSource,
    );
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
 * A redemption names its campaign and the code its flyer carried. Without a code it can only answer a ticket the
 * account already holds; a code no flyer could carry counts as none.
 */
const readRedemption = (value: unknown): { campaign: CampaignKey; code: string | null } | null => {
  const { campaign, code } = (value ?? {}) as Record<string, unknown>;
  if (!isCampaignKey(campaign)) return null;
  return { campaign, code: readCampaignCode(code) };
};

class CampaignRequestError extends Data.TaggedError("CampaignRequestError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
