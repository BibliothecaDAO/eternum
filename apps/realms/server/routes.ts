import { presentsOperatorToken } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { routeChat } from "./chat/routes";
import { handleBotDeviceApproval, handleDeviceChange } from "./devices";
import { handleAdmitShard, handleDirectory, handleDirectoryHistory, handleShardStatus } from "./directory";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { consumeSignInBudget } from "./sign-in-budget";
import { handleNotificationPreferences } from "./notification-preferences";
import { handleProfile, handleProfiles } from "./profiles";
import { handlePushSubscriptions } from "./push-notifications";

/** What the Worker reaches outside its bindings: the colo cache and the shards' Heralds. */
interface WorkerPlatform {
  cache: Cache;
  fetchShard: typeof fetch;
  readLaunchDirectory: () => Promise<{ chains: { chainId: string; gameIds: number[] }[] }>;
}

/** Every /api route: identity under /api/auth, then devices, profiles, chat, notification settings and the directory. */
export const routeIdentityRequest = async (
  request: Request,
  env: IdentityEnv,
  auth: IdentityAuth,
  platform: WorkerPlatform,
) => {
  const { pathname } = new URL(request.url);
  const sendsCode = pathname === "/api/auth/email-otp/send-verification-otp";
  const verifiesCode = pathname === "/api/auth/sign-in/email-otp";
  const requestsCodeAccess = request.method === "POST" && (sendsCode || verifiesCode);
  if (requestsCodeAccess && !(await withinSignInBudget(env, request, sendsCode))) {
    return json({ error: sendsCode ? "too_many_codes" : "too_many_attempts" }, 429);
  }
  if (pathname.startsWith("/api/auth/")) return auth.handler(request);
  if (requiresSameOrigin(request, pathname) && request.headers.get("origin") !== new URL(env.BASE_URL).origin) {
    return json({ error: "invalid_origin" }, 403);
  }
  if (pathname === "/api/devices" && request.method === "POST") {
    return handleDeviceChange(request, {
      auth,
      db: env.DB,
      guardian: env.GUARDIAN,
      accountClassHash: env.ACCOUNT_CLASS_HASH,
    });
  }
  if (pathname === "/api/devices/bots" && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return handleBotDeviceApproval(request, { guardian: env.GUARDIAN, accountClassHash: env.ACCOUNT_CLASS_HASH });
  }
  if (pathname === "/api/profiles" && request.method === "GET") {
    if (!(await withinPublicBudget(env, "profiles", request))) return json({ error: "too_many_requests" }, 429);
    return handleProfiles(env.DB, new URL(request.url).searchParams.get("accounts"));
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
    return handleDirectory(request, { db: env.DB, ...platform });
  }
  if (pathname === "/api/directory/history" && request.method === "GET") {
    if (!(await withinPublicBudget(env, "directory", request))) return json({ error: "too_many_requests" }, 429);
    return handleDirectoryHistory(request, { db: env.DB, ...platform });
  }
  if (pathname.startsWith("/api/directory/shards") && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    if (pathname === "/api/directory/shards") {
      return handleAdmitShard(request, env.DB, platform.fetchShard, {
        accountClassHash: env.ACCOUNT_CLASS_HASH,
        guardianPublicKey: await env.GUARDIAN.publicKey(),
      });
    }
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
  const budget = route === "directory" ? env.DIRECTORY_RATE_LIMIT : env.PUBLIC_RATE_LIMIT;
  return (await budget.limit({ key: `${route}:${client}` })).success;
};

/** A sign-in code costs an email: each client and each address gets a few a minute. */
const withinSignInBudget = async (env: IdentityEnv, request: Request, sendsCode: boolean) => {
  if (!(await withinPublicBudget(env, "sign-in-code", request))) return false;
  const { email } = (await request
    .clone()
    .json()
    .catch(() => ({}))) as { email?: unknown };
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!address) return true; // The auth handler rejects malformed requests without sending or verifying a code.
  if (sendsCode && !(await env.SIGN_IN_CODE_RATE_LIMIT.limit({ key: address })).success) return false;
  return consumeSignInBudget(env.DB, address);
};

const isOperator = (env: IdentityEnv, request: Request) => presentsOperatorToken(request, env.OPERATOR_TOKEN);

/** Cookie authority is accepted only from the app itself; operator endpoints authenticate a bearer token below. */
const requiresSameOrigin = (request: Request, pathname: string): boolean => {
  const operatorRoute = ["/api/devices/bots", "/api/directory/shards", "/api/directory/shards/status"].includes(
    pathname,
  );
  if (operatorRoute) return false;
  return (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) ||
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  );
};
