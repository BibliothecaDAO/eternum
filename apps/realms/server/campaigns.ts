/**
 * A campaign's printed codes as the identity Worker reads them: their shape, and the hash D1 keeps of each. The public
 * campaign facts (key, landing, presets, close, golden count) are @realms-world/identity's CAMPAIGNS.
 */
import { PRINTED_CODE_ALPHABET, PRINTED_CODE_LENGTH, type CampaignKey } from "@realms-world/identity";

/** A new public code of that shape (a referral or a shared link), from the Worker's own randomness. */
export const newPublicCode = () =>
  [...crypto.getRandomValues(new Uint8Array(PRINTED_CODE_LENGTH))]
    .map((byte) => PRINTED_CODE_ALPHABET[byte % PRINTED_CODE_ALPHABET.length])
    .join("");

/** A code as printed, read case-blind; null for anything no flyer carries. */
export const readCampaignCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return code.length === PRINTED_CODE_LENGTH && [...code].every((letter) => PRINTED_CODE_ALPHABET.includes(letter))
    ? code
    : null;
};

type CodeScope = CampaignKey | "seal";

export const codeHashInScope = async (scope: CodeScope, code: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}:${code}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
