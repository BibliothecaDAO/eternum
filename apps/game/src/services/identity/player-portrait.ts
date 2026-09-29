import { IDENTITY_PORTRAITS } from "@realms-world/identity";

/** A chosen portrait's asset; callers without a choice resolve the player's stock portrait instead. */
export const portraitUrl = (portrait: string): string => `/images/avatars/${portrait}.png`;

export function playerPortraitUrl(address: string | bigint, portrait: string | null | undefined): string;
export function playerPortraitUrl(
  address: string | bigint | null | undefined,
  portrait: string | null | undefined,
): string | undefined;
/** Shell and game share the same stock portrait, stable across padded and decimal forms of an address. */
export function playerPortraitUrl(
  address: string | bigint | null | undefined,
  portrait: string | null | undefined,
): string | undefined {
  if (portrait) return portraitUrl(portrait);
  if (address === null || address === undefined) return undefined;
  const key = BigInt(address).toString();
  const hash = Array.from(key).reduce((current, character) => (current * 31 + character.charCodeAt(0)) >>> 0, 0);
  return portraitUrl(IDENTITY_PORTRAITS[hash % IDENTITY_PORTRAITS.length]);
}
