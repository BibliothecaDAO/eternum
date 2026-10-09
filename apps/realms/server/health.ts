import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import type { IdentityEnv } from "./env";
import { json } from "./http";

/** Readiness without a sign-in, email delivery, session creation or public account data. */
export async function handleAccountsHealth(db: D1Database) {
  try {
    await db
      .prepare('SELECT u.id FROM "user" u LEFT JOIN "realms_accounts" a ON a."realmsId"=u."realmsId" LIMIT 1')
      .all();
    return json({ success: true });
  } catch {
    return json({ success: false }, 503);
  }
}

export async function handleChatHealth(env: Pick<IdentityEnv, "CHAT_ROOM">) {
  try {
    await env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(GLOBAL_CHAT_CHANNEL_ID)).health();
    return json({ success: true });
  } catch {
    return json({ success: false }, 503);
  }
}
