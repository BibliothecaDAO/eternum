/**
 * Campaigns: an event's tickets to a campaign home, a realm the player founds through the campaign rather than with a
 * Realm they hold. Each printed flyer carries its own code; the codes live hashed in D1 (`campaign_codes`, written by
 * apps/realms/scripts/campaign-codes.ts), each with the tier it gives, so only this Worker knows which are golden. An
 * account holds one ticket per campaign (`campaign_tickets`), and the relay registers it onchain, under the campaign's
 * key as a short string, when that account founds its home in one of the campaign's games (ValueIdentity.campaignTicket).
 */
export const CAMPAIGNS = {
  "devcon-2026": {
    /** The landing its flyers' QR codes open, each with its own code after it. */
    link: "/join/devcon",
    /** The native presets whose games found its homes: Frontier's three-times-speed Devcon season. */
    presets: [6],
    /** Nov 6 2026, 20:00 IST: the Devcon season's end. */
    redeemUntil: Date.UTC(2026, 10, 6, 14, 30) / 1000,
    /** How many of its printed codes are golden. */
    golden: 20,
  },
} as const satisfies Record<string, Campaign>;

interface Campaign {
  link: string;
  presets: readonly number[];
  redeemUntil: number;
  golden: number;
}

export type CampaignKey = keyof typeof CAMPAIGNS;
export type TicketTier = "regular" | "golden";

export const isCampaignKey = (value: unknown): value is CampaignKey =>
  typeof value === "string" && Object.hasOwn(CAMPAIGNS, value);

/** Eight letters and digits without the look-alikes 0, O, 1 and I; every code has the same shape, whatever its tier. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** A code as printed, read case-blind; null for anything no flyer carries. */
export const readCampaignCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((letter) => CODE_ALPHABET.includes(letter)) ? code : null;
};

/** What D1 keeps of a code: its SHA-256 within its campaign, in hex. */
export const campaignCodeHash = async (campaign: CampaignKey, code: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${campaign}:${code}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
