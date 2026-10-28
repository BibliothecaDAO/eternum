import { Context, Data, Effect, Layer } from "effect";

import { CAMPAIGNS, TIER_ONCHAIN } from "./campaigns";
import type { CampaignKey, TicketTier } from "./campaigns";

interface CampaignTicket {
  campaign: CampaignKey;
  owner: string;
  tier: TicketTier;
}

function createCampaignTicketStore(db: D1Database) {
  const ticketOf = (campaign: CampaignKey, owner: string) =>
    db
      .prepare('SELECT "campaign", "owner", "tier" FROM "campaign_tickets" WHERE "campaign" = ? AND "owner" = ?')
      .bind(campaign, owner)
      .first<CampaignTicket>();

  const tierOfCode = async (campaign: CampaignKey, codeHash: string | null) =>
    codeHash === null
      ? null
      : ((
          await db
            .prepare('SELECT "tier" FROM "campaign_codes" WHERE "campaign" = ? AND "code_hash" = ?')
            .bind(campaign, codeHash)
            .first<{ tier: TicketTier }>()
        )?.tier ?? null);

  /** Null when the account already holds this campaign's ticket, or the golden code was already used as golden. */
  const insertTicket = (campaign: CampaignKey, owner: string, codeHash: string | null, tier: TicketTier, now: number) =>
    db
      .prepare(
        'INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at") VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING "campaign", "owner", "tier"',
      )
      .bind(campaign, owner, codeHash, tier, now)
      .first<CampaignTicket>();

  const read = (campaign: CampaignKey, owner: string) =>
    Effect.tryPromise({
      try: () => ticketOf(campaign, owner),
      catch: (cause) => new CampaignStorageError({ cause }),
    });

  /**
   * The account's ticket: the one it already holds, else a new one from the code. A code no flyer carries, or none,
   * gives a regular ticket; a golden code gives a golden one to its first account only, and a regular one after. Safe to
   * repeat: a retry, or two redemptions at once, return the one ticket.
   */
  const redeem = (campaign: CampaignKey, owner: string, codeHash: string | null, now: number) =>
    Effect.tryPromise({
      try: async (): Promise<CampaignTicket> => {
        const held = await ticketOf(campaign, owner);
        if (held) return held;
        const known = await tierOfCode(campaign, codeHash);
        const code = known === null ? null : codeHash;
        const golden = known === "golden" ? await insertTicket(campaign, owner, code, "golden", now) : null;
        const ticket = golden ?? (await insertTicket(campaign, owner, code, "regular", now));
        const recorded = ticket ?? (await ticketOf(campaign, owner));
        if (!recorded) throw new Error("campaign_ticket_not_recorded");
        return recorded;
      },
      catch: (cause) => new CampaignStorageError({ cause }),
    });
  return { ticketOf, read, redeem };
}

class CampaignStorageError extends Data.TaggedError("CampaignStorageError")<{ readonly cause: unknown }> {}

export class CampaignTicketStore extends Context.Service<
  CampaignTicketStore,
  ReturnType<typeof createCampaignTicketStore>
>()("CampaignTicketStore") {
  static readonly layer = (db: D1Database) => Layer.sync(CampaignTicketStore, () => createCampaignTicketStore(db));
}

/**
 * The ticket an account founds its home with in a game of this preset, as its home's entitlement carries it onchain:
 * the campaign's number and the tier's. Null when it holds no ticket to a campaign of this preset's games.
 */
export async function campaignTicketFor(
  db: D1Database,
  owner: string,
  presetId: number,
): Promise<{ campaignId: number; tier: number } | null> {
  for (const [campaign, { id, presets }] of Object.entries(CAMPAIGNS) as [
    CampaignKey,
    (typeof CAMPAIGNS)[CampaignKey],
  ][]) {
    if (!(presets as readonly number[]).includes(presetId)) continue;
    const ticket = await createCampaignTicketStore(db).ticketOf(campaign, owner);
    if (ticket) return { campaignId: id, tier: TIER_ONCHAIN[ticket.tier] };
  }
  return null;
}
