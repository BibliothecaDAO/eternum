import { normalizeStarknetAddress, presentsOperatorToken } from "@realms-world/identity";
import type { IdentityEnv } from "./env";

/** The external co-signer resolves the receipt's gameplay account directly from identity, never from the relay. */
export async function readPayoutIdentity(db: D1Database, account: string) {
  return db
    .prepare(
      `SELECT u."realmsId", u.address AS wallet FROM realms_accounts a
    JOIN "user" u ON u."realmsId" = a."realmsId"
    WHERE a.address = ? AND u."emailVerified" = 1 AND u.address IS NOT NULL`,
    )
    .bind(normalizeStarknetAddress(account))
    .first<{ realmsId: string; wallet: string }>();
}
export async function handlePayoutIdentity(request: Request, env: IdentityEnv) {
  if (!(await presentsOperatorToken(request, env.OPERATOR_TOKEN)))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const account = new URL(request.url).searchParams.get("account");
  if (!account || !/^0x[0-9a-fA-F]{1,63}$/.test(account))
    return Response.json({ error: "invalid_account" }, { status: 400 });
  return Response.json(
    { identity: await readPayoutIdentity(env.DB, account) },
    { headers: { "cache-control": "no-store" } },
  );
}
