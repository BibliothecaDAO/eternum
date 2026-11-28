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

export const SEAL_CODE_LABEL_PATTERN = /^[a-z0-9-]{1,40}$/;

export const formatSealCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

export const readSealCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const normalized = trimmed.includes("-")
    ? /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(trimmed)
      ? trimmed.replace("-", "")
      : null
    : trimmed;
  return normalized === null ? null : readPublicCode(normalized);
};

export async function deriveSealCodes(label: string, count: number, secret: string): Promise<string[]> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const codes = new Set<string>();
  for (let draw = 0; codes.size < count; draw += 1) {
    const signature = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(`seal-code-mint:v1:${label}:code:${draw}`)),
    );
    let bits = 0n;
    for (let index = 0; index < 5; index += 1) bits = (bits << 8n) | BigInt(signature[index]!);
    let code = "";
    for (let letter = 0; letter < PRINTED_CODE_LENGTH; letter += 1)
      code += PRINTED_CODE_ALPHABET[Number((bits >> BigInt(5 * letter)) & 31n)];
    codes.add(code);
  }
  return [...codes];
}

export const sealCodeHash = async (code: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`seal:${code}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
