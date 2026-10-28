import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { CampaignTicketStore } from "./campaign-ticket-store";
import { CAMPAIGNS, campaignCodeHash, isCampaignKey, readCampaignCode } from "./campaigns";
import type { CampaignKey } from "./campaigns";
import { json, readBody } from "./http";

const REDEEM_BYTES = 1024;

/**
 * POST /api/campaigns/redeem: the signed-in account takes its ticket to a campaign from the code its flyer carried. It
 * answers the ticket's tier, to this account only; repeating it answers the same ticket, so a reload or a retry never
 * shows another outcome, with a code or without. A code another account already took, or one no flyer carries, gives
 * none.
 */
export function handleCampaignRedeem(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    redeemTicket(request, auth).pipe(
      Effect.provide(CampaignTicketStore.layer(db)),
      Effect.catchTag("CampaignStorageError", () => Effect.succeed(json({ error: "campaigns_unavailable" }, 503))),
      Effect.catchTag("CampaignRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );
}

function redeemTicket(request: Request, auth: IdentityAuth) {
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
    const { campaign, code } = asked;
    if (code === null) return json({ error: "invalid_redemption" }, 400);
    const codeHash = yield* Effect.promise(() => campaignCodeHash(campaign, code));
    const ticket = yield* store.redeem(campaign, session.user.realmsId, codeHash, now);
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
