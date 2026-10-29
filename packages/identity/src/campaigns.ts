/**
 * Campaigns: an event's tickets to a campaign home, a realm the player founds through the campaign rather than with a
 * Realm they hold. Each printed flyer carries its own code, good for one account; the identity Worker keeps the codes
 * hashed with the tier each gives (apps/realms/server/campaigns.ts), so only it knows which are golden. An account holds
 * one ticket per campaign, and the relay registers it onchain, under the campaign's key as a short string, when that
 * account founds its home in one of the campaign's games. Nothing else gives a ticket: posters and promotion link to the
 * game itself, where any account founds an ordinary home.
 *
 * What is public about a campaign lives here, read alike by the Worker, the code generator that prints its flyers and
 * the landing that opens its tickets.
 */
export const CAMPAIGNS = {
  "devcon-2026": {
    /** The landing its flyers' QR codes open, each with its own code after it. */
    link: "/join/devcon",
    /** The native presets whose games found its homes: Frontier's three-times-speed Devcon season. */
    presets: [6],
    /** Nov 6 2026, 20:00 IST: the Devcon season's end. */
    redeemUntil: Date.UTC(2026, 10, 6, 14, 30) / 1000,
    /** How many of its printed flyers are golden; the landing's "One of N" says the same number. */
    golden: 15,
  },
} as const satisfies Record<string, Campaign>;

interface Campaign {
  link: string;
  presets: readonly number[];
  redeemUntil: number;
  golden: number;
}

export type CampaignKey = keyof typeof CAMPAIGNS;

export const TICKET_TIERS = ["regular", "golden"] as const;
export type TicketTier = (typeof TICKET_TIERS)[number];

export const isCampaignKey = (value: unknown): value is CampaignKey =>
  typeof value === "string" && Object.hasOwn(CAMPAIGNS, value);
