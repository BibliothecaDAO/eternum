/**
 * A campaign's printed codes as the identity Worker reads them: their shape, and the hash D1 keeps of each. The public
 * campaign facts (key, landing, presets, close, golden count) are @realms-world/identity's CAMPAIGNS.
 */
import type { CampaignKey } from "@realms-world/identity";

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
