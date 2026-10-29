import { Context, Data, Effect, Layer } from "effect";

import { CAMPAIGNS, type CampaignKey, type TicketTier } from "@realms-world/identity";

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

  /** The tier a flyer's code still offers: null for a code no flyer carries, or one another account already took. */
  const unspentTier = async (campaign: CampaignKey, codeHash: string) =>
    (
      await db
        .prepare(
          `SELECT "tier" FROM "campaign_codes" AS code WHERE "campaign" = ? AND "code_hash" = ?
           AND NOT EXISTS (SELECT 1 FROM "campaign_tickets" AS ticket
                           WHERE ticket."campaign" = code."campaign" AND ticket."code_hash" = code."code_hash")`,
        )
        .bind(campaign, codeHash)
        .first<{ tier: TicketTier }>()
    )?.tier ?? null;

  /**
   * Null when the account already holds this campaign's ticket, or another account took this code first. The check and
   * the insert are one statement, so two accounts redeeming one flyer at once cannot both get its ticket.
   */
  const insertTicket = (campaign: CampaignKey, owner: string, codeHash: string, tier: TicketTier, now: number) =>
    db
      .prepare(
        `INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at")
         SELECT ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM "campaign_tickets" WHERE "campaign" = ? AND "code_hash" = ?)
         ON CONFLICT DO NOTHING RETURNING "campaign", "owner", "tier"`,
      )
      .bind(campaign, owner, codeHash, tier, now, campaign, codeHash)
      .first<CampaignTicket>();

  const read = (campaign: CampaignKey, owner: string) =>
    Effect.tryPromise({
      try: () => ticketOf(campaign, owner),
      catch: (cause) => new CampaignStorageError({ cause }),
    });

  const offered = (campaign: CampaignKey, codeHash: string) =>
    Effect.tryPromise({
      try: () => unspentTier(campaign, codeHash),
      catch: (cause) => new CampaignStorageError({ cause }),
    });

  /**
   * The account's ticket from its flyer's code, at the tier the code offered; the one it holds if it already has one.
   * Null when another account took the code first. Safe to repeat: a retry, or two redemptions at once, return the one
   * ticket.
   */
  const redeem = (campaign: CampaignKey, owner: string, codeHash: string, tier: TicketTier, now: number) =>
    Effect.tryPromise({
      try: async (): Promise<CampaignTicket | null> =>
        (await insertTicket(campaign, owner, codeHash, tier, now)) ?? (await ticketOf(campaign, owner)),
      catch: (cause) => new CampaignStorageError({ cause }),
    });
  return { ticketOf, read, offered, redeem };
}

class CampaignStorageError extends Data.TaggedError("CampaignStorageError")<{ readonly cause: unknown }> {}

export class CampaignTicketStore extends Context.Service<
  CampaignTicketStore,
  ReturnType<typeof createCampaignTicketStore>
>()("CampaignTicketStore") {
  static readonly layer = (db: D1Database) => Layer.sync(CampaignTicketStore, () => createCampaignTicketStore(db));
}

/** The ticket an account founds its home with in a game of this preset; null when it holds none for this preset's games. */
export async function campaignTicketFor(
  db: D1Database,
  owner: string,
  presetId: number,
): Promise<{ campaign: CampaignKey; tier: TicketTier } | null> {
  const store = createCampaignTicketStore(db);
  for (const campaign of Object.keys(CAMPAIGNS) as CampaignKey[]) {
    if (!(CAMPAIGNS[campaign].presets as readonly number[]).includes(presetId)) continue;
    const ticket = await store.ticketOf(campaign, owner);
    if (ticket) return { campaign, tier: ticket.tier };
  }
  return null;
}
