export const PRINTED_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PRINTED_CODE_LENGTH = 8;

export const CAMPAIGNS = {
  "devcon-2026": {
    /** The native presets whose games found its homes: Frontier's three-times-speed Devcon season. */
    presets: [6],
    /** The clock its event keeps, which its season's dates are written in beside UTC. */
    clock: { timeZone: "Asia/Kolkata", zone: "IST" },
    /** Nov 3 2026, 10:30 IST: the Devcon season's first day opens. */
    startsAt: Date.UTC(2026, 10, 3, 5, 0) / 1000,
    /** Nov 6 2026, 23:30 IST: the Devcon season's end, after which no new ticket is given and no friend counts. */
    redeemUntil: Date.UTC(2026, 10, 6, 18, 0) / 1000,
    /**
     * Golden through friends: each friend's ticket is golden at these odds, drawn as the link gives it, and a golden
     * friend who counts (founded a realm, cleared a site) turns the inviter golden; at `goldenLinkAt` counted friends the
     * link goes golden: the inviter, every friend on it and every later ticket from it.
     */
    referral: { goldenOdds: 0.1, goldenLinkAt: 10 },
  },
} as const satisfies Record<string, Campaign>;

interface Campaign {
  presets: readonly number[];
  clock: { timeZone: string; zone: string };
  startsAt: number;
  redeemUntil: number;
  referral: { goldenOdds: number; goldenLinkAt: number };
}

export type CampaignKey = keyof typeof CAMPAIGNS;

export type TicketTier = "regular" | "golden";

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
