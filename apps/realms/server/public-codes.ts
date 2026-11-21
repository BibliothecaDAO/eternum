import { PRINTED_CODE_ALPHABET, PRINTED_CODE_LENGTH } from "@realms-world/identity";

/** A new public code of that shape (a referral or a shared link), from the Worker's own randomness. */
export const newPublicCode = () =>
  [...crypto.getRandomValues(new Uint8Array(PRINTED_CODE_LENGTH))]
    .map((byte) => PRINTED_CODE_ALPHABET[byte % PRINTED_CODE_ALPHABET.length])
    .join("");

/** A code as printed, read case-blind; null for anything no flyer carries. */
export const readPublicCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return code.length === PRINTED_CODE_LENGTH && [...code].every((letter) => PRINTED_CODE_ALPHABET.includes(letter))
    ? code
    : null;
};

export const sealCodeHash = async (code: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`seal:${code}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
