import type { IdentityAuth } from "./auth";
import { routeChat } from "./chat/routes";
import { handleDeviceChange } from "./devices";
import { handleAdmitShard, handleDirectory, handleShardStatus } from "./directory";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { handleNotificationPreferences } from "./notification-preferences";
import { handleProfile } from "./profiles";
import { handlePushSubscriptions } from "./push-notifications";

/** What the Worker reaches outside its bindings: the colo cache and the shards' Heralds. */
interface WorkerPlatform {
  cache: Cache;
  fetchShard: typeof fetch;
}

/** Every /api route: identity under /api/auth, then devices, profiles, chat, notification settings and the directory. */
export const routeIdentityRequest = async (
  request: Request,
  env: IdentityEnv,
  auth: IdentityAuth,
  platform: WorkerPlatform,
) => {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/auth/sign-in/anonymous" && !(await withinPublicBudget(env, "anonymous", request))) {
    return json({ error: "too_many_requests" }, 429);
  }
  if (pathname.startsWith("/api/auth/")) return auth.handler(request);
  if (pathname === "/api/devices" && request.method === "POST") {
    return handleDeviceChange(request, {
      auth,
      db: env.DB,
      guardian: env.GUARDIAN,
      accountClassHash: env.ACCOUNT_CLASS_HASH,
    });
  }
  if (pathname.startsWith("/api/profiles/") && request.method === "GET") {
    if (!(await withinPublicBudget(env, "profiles", request))) return json({ error: "too_many_requests" }, 429);
    return handleProfile(env.DB, pathname.slice("/api/profiles/".length));
  }
  if (pathname.startsWith("/api/chat/")) return routeChat(request, env, auth, pathname);
  if (pathname === "/api/notifications/preferences") return handleNotificationPreferences(request, auth, env.DB);
  if (pathname.startsWith("/api/notifications/push/")) return handlePushSubscriptions(request, auth, env);
  if (pathname === "/api/directory" && request.method === "GET") {
    if (!(await withinPublicBudget(env, "directory", request))) return json({ error: "too_many_requests" }, 429);
    return handleDirectory({ db: env.DB, ...platform });
  }
  if (pathname.startsWith("/api/directory/shards") && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    if (pathname === "/api/directory/shards") return handleAdmitShard(request, env.DB, platform.fetchShard);
    if (pathname === "/api/directory/shards/status") return handleShardStatus(request, env.DB);
  }
  if (pathname === "/api/guardian" && request.method === "GET") {
    return json({ publicKey: await env.GUARDIAN.publicKey(), accountClassHash: env.ACCOUNT_CLASS_HASH });
  }
  if (pathname === "/api/health" && request.method === "GET") {
    return json({ service: "realms-identity", environment: env.ENVIRONMENT, version: env.VERSION.id });
  }
  return json({ error: "not_found" }, 404);
};

/** Unauthenticated routes share one per-client budget, counted per route. */
const withinPublicBudget = async (env: IdentityEnv, route: string, request: Request) => {
  const client = request.headers.get("cf-connecting-ip") ?? "unknown";
  return (await env.PUBLIC_RATE_LIMIT.limit({ key: `${route}:${client}` })).success;
};

/** The operator's bearer token, compared by digest so the comparison time says nothing about the token. */
const isOperator = async (env: IdentityEnv, request: Request) => {
  const presented = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const [expected, actual] = await Promise.all(
    [env.DIRECTORY_ADMIN_TOKEN, presented].map(async (value) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].join(","),
    ),
  );
  return presented.length > 0 && expected === actual;
};
