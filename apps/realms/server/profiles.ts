import { profileOfIdentityUser } from "@realms-world/identity";

import { json } from "./http";

const REALMS_ID = /^0x[0-9a-fA-F]{1,64}$/;

/** GET /api/profiles/:realms_id — the public name and portrait of one Realms account, as chosen by its player. */
export const handleProfile = async (db: D1Database, realmsId: string): Promise<Response> => {
  if (!REALMS_ID.test(realmsId)) return json({ error: "invalid_realms_id" }, 400);
  const normalized = `0x${BigInt(realmsId).toString(16)}`;
  const user = await db
    .prepare('SELECT id, name, image FROM "user" WHERE "realmsId" = ?')
    .bind(normalized)
    .first<{ id: string; name: string; image: string | null }>();
  return user ? json({ realmsId: normalized, ...profileOfIdentityUser(user) }) : json({ error: "not_found" }, 404);
};
