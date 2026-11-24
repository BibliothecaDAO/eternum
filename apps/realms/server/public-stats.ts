import environments from "../../../deploy/first/environments.json";
import type { IdentityEnv } from "./env";

const ACCOUNT_COUNT_SECONDS = 3_600;

export const readableByDocs = (response: Response, environment: IdentityEnv["ENVIRONMENT"]): Response => {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", docsOriginOf(environment));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const docsOriginOf = (environment: IdentityEnv["ENVIRONMENT"]): string => {
  const deployment = Object.values(environments).find(({ worker }) => worker === environment);
  if (!deployment) throw new Error(`No deployment serves the ${environment} identity Worker`);
  return deployment.docs.origin;
};

export const handleAccountCount = async (request: Request, db: D1Database, cache: Cache): Promise<Response> => {
  const key = new Request(new URL("/api/stats/accounts", request.url));
  const cached = await cache.match(key);
  if (cached) return cached;
  const counted = await db
    .prepare(
      `SELECT COUNT(*) AS "accounts" FROM "user" u
       WHERE NOT EXISTS (SELECT 1 FROM "account_deletions" d WHERE d."realms_id" = u."realmsId")`,
    )
    .first<{ accounts: number }>();
  if (!counted) throw new Error("account_count_unanswered");
  const response = Response.json(
    { accounts: counted.accounts },
    { headers: { "cache-control": `public, max-age=${ACCOUNT_COUNT_SECONDS}` } },
  );
  await cache.put(key, response.clone());
  return response;
};
