import { CAMPAIGNS, type CampaignKey, type TicketTier } from "@realms-world/identity";

/** The ticket an account founds its home with in a game of this preset; null when it holds none for this preset's games. */
export async function campaignTicketFor(
  db: D1Database,
  owner: string,
  presetId: number,
): Promise<{ campaign: CampaignKey; tier: TicketTier } | null> {
  for (const campaign of Object.keys(CAMPAIGNS) as CampaignKey[]) {
    if (!(CAMPAIGNS[campaign].presets as readonly number[]).includes(presetId)) continue;
    const ticket = await db
      .prepare('SELECT "tier" FROM "campaign_tickets" WHERE "campaign" = ? AND "owner" = ?')
      .bind(campaign, owner)
      .first<{ tier: TicketTier }>();
    if (ticket) return { campaign, tier: ticket.tier };
  }
  return null;
}
