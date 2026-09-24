import { IDENTITY_PROFILES_BATCH_LIMIT, profileOfIdentityUser, type IdentityProfile } from "@realms-world/identity";

import { json } from "./http";

const HEX_FELT = /^0x[0-9a-fA-F]{1,64}$/;

/** GET /api/profiles/:realms_id — the public name and portrait of one Realms account, as chosen by its player. */
export const handleProfile = async (db: D1Database, realmsId: string): Promise<Response> => {
  if (!HEX_FELT.test(realmsId)) return json({ error: "invalid_realms_id" }, 400);
  const normalized = `0x${BigInt(realmsId).toString(16)}`;
  const user = await db
    .prepare('SELECT id, name, image FROM "user" WHERE "realmsId" = ?')
    .bind(normalized)
    .first<{ id: string; name: string; image: string | null }>();
  return user ? json({ realmsId: normalized, ...profileOfIdentityUser(user) }) : json({ error: "not_found" }, 404);
};

/** D1 binds at most 100 parameters per statement. */
const ADDRESSES_PER_STATEMENT = 100;

interface NamedAccountRow {
  address: string;
  id: string;
  name: string;
  image: string | null;
}

/**
 * GET /api/profiles?accounts=<addresses> — the profiles behind gameplay account addresses, keyed by each address as
 * sent. An address has a profile only if our guardian approved a device for it, which is what realms_accounts records.
 * An account's own realms_id is never trusted: anyone can deploy an account under their own guardian claiming any
 * Realms id. Unknown addresses are absent, and the client shows them as addresses.
 */
export const handleProfiles = async (db: D1Database, accountsParameter: string | null): Promise<Response> => {
  const requested = (accountsParameter ?? "").split(",").filter(Boolean);
  if (requested.length > IDENTITY_PROFILES_BATCH_LIMIT) return json({ error: "too_many_accounts" }, 400);
  if (!requested.every((address) => HEX_FELT.test(address))) return json({ error: "invalid_account" }, 400);
  const byAddress = await approvedProfiles(db, [...new Set(requested.map(canonical))]);
  const profiles: Record<string, IdentityProfile> = {};
  for (const address of requested) {
    const profile = byAddress.get(canonical(address));
    if (profile) profiles[address] = profile;
  }
  return json({ profiles });
};

const approvedProfiles = async (db: D1Database, addresses: string[]): Promise<Map<string, IdentityProfile>> => {
  const chunks = Array.from({ length: Math.ceil(addresses.length / ADDRESSES_PER_STATEMENT) }, (_, index) =>
    addresses.slice(index * ADDRESSES_PER_STATEMENT, (index + 1) * ADDRESSES_PER_STATEMENT),
  );
  if (chunks.length === 0) return new Map();
  const results = await db.batch<NamedAccountRow>(
    chunks.map((chunk) =>
      db
        .prepare(
          `SELECT a."address", u."id", u."name", u."image" FROM "realms_accounts" a
           JOIN "user" u ON u."realmsId" = a."realmsId"
           WHERE a."address" IN (${chunk.map(() => "?").join(", ")})`,
        )
        .bind(...chunk),
    ),
  );
  return new Map(results.flatMap(({ results: rows }) => rows.map((row) => [row.address, profileOfIdentityUser(row)])));
};

const canonical = (address: string) => `0x${BigInt(address).toString(16)}`;
