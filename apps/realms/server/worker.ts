import { createIdentityAuth, type IdentityAuth } from "./auth";
import { handleDeviceChange } from "./devices";
import { decodeIdentityEnv, type IdentityEnv } from "./env";
import { json } from "./http";
import { handleNotificationPreferences } from "./notification-preferences";
import { handleProfile } from "./profiles";
import { handlePushSubscriptions } from "./push-notifications";

/**
 * The identity Worker, served under the app's /api: better-auth owns /api/auth/*, and the rest are the account's
 * device approvals, public profiles and notification settings.
 */
export default {
  fetch(request: Request, rawEnv: Record<string, unknown>): Promise<Response> {
    const env = decodeIdentityEnv(rawEnv);
    return routeIdentityRequest(request, env, identityAuthOf(rawEnv, env));
  },
};

// One auth instance per isolate and environment; better-auth holds no per-request state.
const authByEnv = new WeakMap<object, IdentityAuth>();
const identityAuthOf = (rawEnv: object, env: IdentityEnv): IdentityAuth => {
  const cached = authByEnv.get(rawEnv);
  if (cached) return cached;
  const auth = createIdentityAuth(env);
  authByEnv.set(rawEnv, auth);
  return auth;
};

export const routeIdentityRequest = async (request: Request, env: IdentityEnv, auth: IdentityAuth) => {
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
  if (pathname === "/api/notifications/preferences") return handleNotificationPreferences(request, auth, env.DB);
  if (pathname.startsWith("/api/notifications/push/")) return handlePushSubscriptions(request, auth, env.DB);
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
