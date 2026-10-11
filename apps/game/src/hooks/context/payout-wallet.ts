import type { IdentityUser } from "@realms-world/identity";

/**
 * The account's payout wallet: the one wallet the identity service holds linked to it, as the session carries it. It
 * receives at once; null when the account has linked none.
 */
export const payoutAddressOf = (user: IdentityUser): string | null => user.address ?? null;
