/**
 * Campaigns: an event's tickets to a campaign home, a realm the player founds through the campaign rather than with a
 * Realm they hold. Each printed code is good for one account; the identity Worker keeps the codes hashed with the tier
 * each gives (apps/realms/server/campaigns.ts), so only it knows which are golden. A code every flyer shares instead
 * draws one of the unspent printed codes at random for each account that brings it, so the tiers stay exact. An account holds
 * one ticket per campaign, and the relay registers it onchain, under the campaign's key as a short string, when that
 * account founds its home in one of the campaign's games. Nothing else gives a ticket: posters and promotion link to the
 * game itself, where any account founds an ordinary home.
 *
 * What is public about a campaign lives here, read alike by the Worker, the code generator that prints its flyers, the
 * landing that opens its tickets, and the docs page, patch notes and admin lab that state its season's dates.
 */
export const CAMPAIGNS = {
  "devcon-2026": {
    /** The landing its flyers' QR codes open, each with its own code after it. */
    link: "/join/devcon",
    /** The native presets whose games found its homes: Frontier's three-times-speed Devcon season. */
    presets: [6],
    /** The clock its event keeps, which its season's dates are written in beside UTC. */
    clock: { timeZone: "Asia/Kolkata", zone: "IST" },
    /** Nov 3 2026, 10:30 IST: the Devcon season's first day opens. */
    startsAt: Date.UTC(2026, 10, 3, 5, 0) / 1000,
    /** Nov 6 2026, 23:30 IST: the Devcon season's end, after which no new ticket is given. */
    redeemUntil: Date.UTC(2026, 10, 6, 18, 0) / 1000,
    /** How many of its printed flyers are golden; the landing's "One of N" says the same number. */
    golden: 15,
  },
} as const satisfies Record<string, Campaign>;

interface Campaign {
  link: string;
  presets: readonly number[];
  clock: { timeZone: string; zone: string };
  startsAt: number;
  redeemUntil: number;
  golden: number;
}

export type CampaignKey = keyof typeof CAMPAIGNS;

export const TICKET_TIERS = ["regular", "golden"] as const;
export type TicketTier = (typeof TICKET_TIERS)[number];

export const isCampaignKey = (value: unknown): value is CampaignKey =>
  typeof value === "string" && Object.hasOwn(CAMPAIGNS, value);

/** A moment of a campaign's season as players read it in one zone: "Tue 3 Nov 10:30 IST". */
export const seasonMoment = (seconds: number, timeZone: string, zone: string) =>
  `${new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .format(seconds * 1000)
    .replace(",", "")} ${zone}`;
