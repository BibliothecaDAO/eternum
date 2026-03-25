/**
 * Realm name lookup by realm ID.
 *
 * Imports the shared realm-names.json from client/public. Bun inlines
 * this at build time so the binary has no runtime file dependency.
 */

import realmNames from "../../../../public/jsons/realm-names.json";

const names = realmNames as Record<string, string>;

/**
 * Get a realm's name by its realm ID (not entity ID).
 *
 * @param realmId - The realm's internal ID from structure metadata.
 * @returns The realm name, or empty string if not found.
 */
export function getRealmName(realmId: number | string): string {
  return names[String(realmId)] ?? "";
}
