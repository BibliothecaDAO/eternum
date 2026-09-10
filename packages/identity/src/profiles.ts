import type { IdentityProfile } from "./types";

/** A user's name is "chosen" once it differs from the address it defaulted to at sign-in. */
export const hasChosenIdentityName = (user: { id: string; name: string }): boolean =>
  user.name.toLowerCase() !== user.id.toLowerCase();

/** The public profile of a signed-in user, by the same rule the profiles endpoint applies. */
export const profileOfIdentityUser = (user: { id: string; name: string; image?: string | null }): IdentityProfile => ({
  name: hasChosenIdentityName(user) ? user.name : null,
  portrait: user.image ?? null,
});

export const IDENTITY_PROFILES_BATCH_LIMIT = 200;

/**
 * Public, batched: gameplay account addresses in, profiles out, keyed by the address as sent. Unknown accounts are
 * absent from the result.
 */
export async function fetchIdentityProfiles(
  origin: string,
  accounts: readonly string[],
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<Record<string, IdentityProfile>> {
  if (accounts.length === 0) return {};
  if (accounts.length > IDENTITY_PROFILES_BATCH_LIMIT) {
    throw new Error(`Identity profiles take at most ${IDENTITY_PROFILES_BATCH_LIMIT} accounts per request`);
  }
  const response = await fetch(`${origin}/api/profiles?accounts=${accounts.join(",")}`);
  if (!response.ok) throw new Error(`Identity profiles request failed with status ${response.status}`);
  const payload = (await response.json()) as { profiles: Record<string, IdentityProfile> };
  return payload.profiles;
}
