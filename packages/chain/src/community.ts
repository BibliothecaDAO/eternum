/**
 * The Realms X account: the one place it is written. The game client, realms.world and the docs read it from here, and
 * scripts/check-realms-x-account.mjs fails any link to it, or tag of it, written anywhere else.
 */
const REALMS_X_HANDLE = "LootRealms";

/** Handles Realms posted from before; a surface naming one is out of date. */
const RETIRED_REALMS_X_HANDLES = ["realmsgg"] as const;

/** The account's profile link. */
export const REALMS_X_URL = `https://x.com/${REALMS_X_HANDLE}`;

/** The account as a post tags it. */
export const REALMS_X_TAG = `@${REALMS_X_HANDLE}`;
