import { Context, Data, Effect, Layer } from "effect";

import { CAMPAIGNS } from "./campaigns";
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

  const tierOfCode = async (campaign: CampaignKey, codeHash: string) =>
    (
      await db
        .prepare('SELECT "tier" FROM "campaign_codes" WHERE "campaign" = ? AND "code_hash" = ?')
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

  /**
   * The account's ticket: the one it already holds, else the one its flyer's code gives, regular or golden. Null when the
   * code is no flyer's or another account already took it. Safe to repeat: a retry, or two redemptions at once, return
   * the one ticket.
   */
  const redeem = (campaign: CampaignKey, owner: string, codeHash: string, now: number) =>
    Effect.tryPromise({
      try: async (): Promise<CampaignTicket | null> => {
        const held = await ticketOf(campaign, owner);
        if (held) return held;
        const tier = await tierOfCode(campaign, codeHash);
        if (!tier) return null;
        return (await insertTicket(campaign, owner, codeHash, tier, now)) ?? (await ticketOf(campaign, owner));
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
