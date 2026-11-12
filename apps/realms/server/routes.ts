import { handlePayoutIdentity } from "./payout-identity";
import { presentsOperatorToken, SHARE_PATH, VISIT_RECORD_SECONDS } from "@realms-world/identity";

import { handleAccountDeletion } from "./account-deletion";
import type { IdentityAuth } from "./auth";
import { handleChatRetention } from "./chat/retention";
import { routeChat } from "./chat/routes";
import { handleBotDeviceApproval, handleDeviceChange } from "./devices";
import { claimSocialHandoff, returnFromProvider, startSocialSignIn } from "./social-handoff";
import {
  handleAdmitShard,
  handleDirectory,
  handleDirectoryHistory,
  handleRegisterPendingShard,
  handleShardStatus,
  registeredShards,
} from "./directory";
import { ACCOUNT_CLASS_HASH, socialProvidersOf, type IdentityEnv } from "./env";
import { json } from "./http";
import { keepBrowser, noteBrowser } from "./browsers";
import { handleBuildOrders } from "./build-orders";
import { handleInterfaceOpening } from "./interface-opening";
import {
  campaignStandings,
  hasCampaignHomeSource,
  homeSourceOf,
  playerAccounts,
  sitesClearedOn,
} from "./campaign-entry";
import {
  handleCampaignReferral,
  handleCampaignReferrer,
  settleReferrals,
  type ReferralWorld,
} from "./campaign-referrals";
import { handleCampaignDraw, handleCampaignRedeem } from "./campaign-tickets";
import { handleNotificationPreferences } from "./notification-preferences";
import { handleNewsEmailOptOut, NEWS_EMAIL_OPT_OUT_PATH } from "./news-email-opt-out";
import { handleProfile, handleProfiles } from "./profiles";
import { handleRatings } from "./ratings";
import { handleRatingTop } from "./rating-top";
import { handleAccountsHealth, handleChatHealth } from "./health";
import { handlePushSubscriptions } from "./push-notifications";
import { handleShareCard, handleShareCardUpload, handleSharedPage } from "./share-cards";
import {
  handleCreateShare,
  handleShareReport,
  handleSharePosted,
  handleShareTally,
  handleShareVisit,
  type ShareWorld,
} from "./shares";
import { handleWalletCounts } from "./wallet-counts";

/** What the Worker reaches outside its bindings: the colo cache and the shards' Heralds. */
interface WorkerPlatform {
  cache: Cache;
  /** The game's page as its host serves it, for a shared link's address (/s/<code>), which this Worker's route takes. */
  fetchPage: (request: Request) => Promise<Response>;
  fetchShard: typeof fetch;
  readLaunchDirectory: () => Promise<{
    chains: { chainId: string; games: { gameId: number; slotId: number | null }[] }[];
  }>;
}

/**
 * Every /api route: identity under /api/auth, a news email's stop link, then the account's deletion, devices, profiles,
 * chat, notification settings, build orders, campaign tickets and the directory.
 */
export const routeIdentityRequest = async (
  request: Request,
  env: IdentityEnv,
  auth: IdentityAuth,
  platform: WorkerPlatform,
) => {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith(`${SHARE_PATH}/`) && request.method === "GET")
    return handleSharedPage(request, { db: env.DB, cards: env.SHARE_CARDS, origin: env.BASE_URL }, platform.fetchPage);
  const sendsCode = pathname === "/api/auth/email-otp/send-verification-otp";
  const verifiesCode = ["/api/auth/sign-in/email-otp", "/api/auth/email-otp/check-verification-otp"].includes(pathname);
  const requestsCodeAccess = request.method === "POST" && (sendsCode || verifiesCode);
  if (requestsCodeAccess) {
    const refusal = await codeAccess(env, request, sendsCode);
    if (refusal) return refusal;
    if (sendsCode) return sendCodeWithExpiry(request, auth);
  }
  if (pathname === "/api/auth/get-session" && request.method === "GET") return accountSession(request, auth, env.DB);
  if (pathname === "/api/auth/providers" && request.method === "GET")
    return json({ providers: Object.keys(socialProvidersOf(env)) });
  if (pathname === "/api/auth/sign-in/social" && request.method === "POST")
    return startSocialSignIn(request, auth, env);
  // Every provider's return (Apple's POST is turned into this GET by better-auth).
  if (pathname.startsWith("/api/auth/callback/") && request.method === "GET")
    return returnFromProvider(request, auth, env);
  if (pathname === "/api/auth/social-handoff" && request.method === "POST") {
    if (!(await withinPublicBudget(env, "sign-in-code", request))) return json({ error: "too_many_attempts" }, 429);
    return claimSocialHandoff(request, env);
  }
  if (pathname.startsWith("/api/auth/")) return auth.handler(request);
  // A news email's stop link: its signature is its authority, and a mail client's one-click POST carries no Origin.
  if (pathname === NEWS_EMAIL_OPT_OUT_PATH && (request.method === "GET" || request.method === "POST"))
    return handleNewsEmailOptOut(request, env);
  if (requiresSameOrigin(request, pathname) && request.headers.get("origin") !== new URL(env.BASE_URL).origin) {
    return json({ error: "invalid_origin" }, 403);
  }
  if (pathname === "/api/account" && request.method === "DELETE") return handleAccountDeletion(request, auth, env);
  if (pathname === "/api/devices" && request.method === "POST") {
    return handleDeviceChange(request, {
      auth,
      db: env.DB,
      guardian: env.GUARDIAN,
      accountClassHash: ACCOUNT_CLASS_HASH,
    });
  }
  if (pathname === "/api/devices/bots" && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return handleBotDeviceApproval(request, {
      db: env.DB,
      guardian: env.GUARDIAN,
      accountClassHash: ACCOUNT_CLASS_HASH,
    });
  }
  if ((pathname === "/api/ratings" || pathname === "/api/ratings/top") && request.method === "GET") {
    if (!(await withinPublicBudget(env, "ratings", request))) return json({ error: "too_many_requests" }, 429);
    return pathname === "/api/ratings/top"
      ? handleRatingTop(env, new URL(request.url))
      : handleRatings(env, new URL(request.url));
  }
  if (pathname === "/api/profiles" && request.method === "GET") {
    if (!(await withinPublicBudget(env, "profiles", request))) return json({ error: "too_many_requests" }, 429);
    return handleProfiles(env.DB, new URL(request.url).searchParams.get("accounts"));
  }
  if (pathname.startsWith("/api/profiles/") && request.method === "GET") {
    if (!(await withinPublicBudget(env, "profiles", request))) return json({ error: "too_many_requests" }, 429);
    return handleProfile(env.DB, pathname.slice("/api/profiles/".length));
  }
  if (pathname === "/api/health/accounts" && request.method === "GET") return handleAccountsHealth(env.DB);
  if (pathname === "/api/chat/health" && request.method === "GET") return handleChatHealth(env);
  if (pathname === "/api/operator/chat-retention" && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return handleChatRetention(request, env);
  }
  if (pathname.startsWith("/api/chat/")) return routeChat(request, env, auth, pathname);
  if (pathname === "/api/notifications/preferences") return handleNotificationPreferences(request, auth, env.DB);
  if (pathname === "/api/build-orders") return handleBuildOrders(request, auth, env.DB);
  if (pathname === "/api/interface/opening") return handleInterfaceOpening(request, auth, env.DB);
  if (pathname === "/api/operator/campaign-draw" && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return handleCampaignDraw(request, env.DB, (realmsId, presets) =>
      hasCampaignHomeSource(env, platform.fetchShard, realmsId, presets),
    );
  }
  if (pathname === "/api/campaigns/redeem") {
    const world = referralWorld(env, platform);
    return handleCampaignRedeem(request, auth, env.DB, {
      hasSource: (realmsId, presets) => hasCampaignHomeSource(env, platform.fetchShard, realmsId, presets),
      settle: (realmsId, campaign) => settleReferrals(world, campaign, realmsId, Math.floor(Date.now() / 1000)),
    });
  }
  if (pathname === "/api/campaigns/referral" && request.method === "GET")
    return handleCampaignReferral(request, auth, referralWorld(env, platform));
  if (pathname.startsWith("/api/campaigns/referral/") && request.method === "GET") {
    if (!(await withinPublicBudget(env, "referral", request))) return json({ error: "too_many_requests" }, 429);
    return handleCampaignReferrer(env.DB, new URL(request.url), pathname.slice("/api/campaigns/referral/".length));
  }
  if (pathname.startsWith("/api/shares") || pathname === "/api/operator/shares")
    return routeShares(request, env, auth, platform, pathname);
  if (pathname.startsWith("/api/notifications/push/")) return handlePushSubscriptions(request, auth, env);
  if (pathname === "/api/directory" && request.method === "GET") {
    if (!(await withinPublicBudget(env, "directory", request))) return json({ error: "too_many_requests" }, 429);
    return handleDirectory(request, { db: env.DB, ...platform });
  }
  if (pathname === "/api/directory/history" && request.method === "GET") {
    if (!(await withinPublicBudget(env, "directory", request))) return json({ error: "too_many_requests" }, 429);
    return handleDirectoryHistory(request, { db: env.DB, ...platform });
  }
  if (pathname === "/api/operator/payout-identity" && request.method === "GET")
    return handlePayoutIdentity(request, env);
  if (pathname === "/api/operator/wallets" && request.method === "GET") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return handleWalletCounts(env.DB);
  }
  if (pathname === "/api/directory/shards" && request.method === "GET") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return json({ shards: await registeredShards(env.DB) });
  }
  if (pathname.startsWith("/api/directory/shards") && request.method === "POST") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    if (pathname === "/api/directory/shards" || pathname === "/api/directory/shards/pending") {
      const admit = pathname.endsWith("/pending") ? handleRegisterPendingShard : handleAdmitShard;
      return admit(request, env.DB, platform.fetchShard, {
        accountClassHash: ACCOUNT_CLASS_HASH,
        guardianPublicKey: await env.GUARDIAN.publicKey(),
      });
    }
    if (pathname === "/api/directory/shards/status") return handleShardStatus(request, env.DB);
  }
  if (pathname === "/api/guardian" && request.method === "GET") {
    return json({ publicKey: await env.GUARDIAN.publicKey(), accountClassHash: ACCOUNT_CLASS_HASH });
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

/** Each client and address may request only a few codes per minute. */
const codeAccess = async (env: IdentityEnv, request: Request, sendsCode: boolean) => {
  if (!(await withinPublicBudget(env, "sign-in-code", request))) return json({ error: "too_many_attempts" }, 429);
  if (!sendsCode) return null;
  const { email } = (await request
    .clone()
    .json()
    .catch(() => ({}))) as { email?: unknown };
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (address && !(await env.SIGN_IN_CODE_RATE_LIMIT.limit({ key: address })).success)
    return json({ error: "too_many_codes" }, 429);
  return null;
};

const isOperator = (env: IdentityEnv, request: Request) => presentsOperatorToken(request, env.OPERATOR_TOKEN);

/**
 * Shared links: a player's link for a moment and its post (signed in), a friend's visit (public, on the per-client
 * budget), what the player's links brought (signed in) and every link's funnel (operator).
 */
const routeShares = async (
  request: Request,
  env: IdentityEnv,
  auth: IdentityAuth,
  platform: WorkerPlatform,
  pathname: string,
) => {
  const [, , , code, action] = pathname.split("/");
  if (pathname === "/api/operator/shares" && request.method === "GET") {
    if (!(await isOperator(env, request))) return json({ error: "unauthorized" }, 401);
    return handleShareReport(shareWorld(env, platform));
  }
  if (pathname === "/api/shares" && request.method === "POST") return handleCreateShare(request, auth, env.DB);
  if (pathname === "/api/shares" && request.method === "GET")
    return handleShareTally(request, auth, shareWorld(env, platform));
  if (code && action === "posted" && request.method === "POST") return handleSharePosted(request, auth, env.DB, code);
  if (code && action === "card" && request.method === "PUT")
    return handleShareCardUpload(request, auth, env.DB, env.SHARE_CARDS, code);
  if (code && action === "card" && request.method === "GET") return handleShareCard(env.DB, env.SHARE_CARDS, code);
  if (code && action === "visit" && request.method === "POST") {
    if (!(await withinPublicBudget(env, "share", request))) return json({ error: "too_many_requests" }, 429);
    return handleShareVisit(request, env.DB, code);
  }
  return json({ error: "not_found" }, 404);
};

/** What share settlement reaches: each link's season board on its shard's Herald. */
const shareWorld = (env: IdentityEnv, platform: WorkerPlatform): ShareWorld => ({
  db: env.DB,
  sitesCleared: (game) => sitesClearedOn(env, platform.fetchShard, game),
  accountOf: playerAccounts(env),
});

/** What referral settlement reaches: the shards' Heralds for home sources and season boards, and the relay. */
const referralWorld = (env: IdentityEnv, platform: WorkerPlatform): ReferralWorld => ({
  db: env.DB,
  homeSource: (realmsId, presets) => homeSourceOf(env, platform.fetchShard, realmsId, presets),
  standings: (presets) => campaignStandings(env, platform.fetchShard, presets),
  accountOf: playerAccounts(env),
  upgradeHome: (home) =>
    env.VALUE_RELAY.fetch("https://value-relay/api/value/operator/campaign-upgrade", {
      method: "POST",
      redirect: "manual",
      headers: { authorization: `Bearer ${env.OPERATOR_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(home),
    }),
});

/** Cookie authority is accepted only from the app itself; operator endpoints authenticate a bearer token below. */
const requiresSameOrigin = (request: Request, pathname: string): boolean => {
  const operatorRoute = [
    "/api/operator/campaign-draw",
    "/api/operator/chat-retention",
    "/api/devices/bots",
    "/api/directory/shards",
    "/api/directory/shards/status",
    "/api/directory/shards/pending",
  ].includes(pathname);
  if (operatorRoute) return false;
  return (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) ||
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  );
};

/** Read the verification the auth plugin wrote; mail delivery time must not extend the code's life. */
const sendCodeWithExpiry = async (request: Request, auth: IdentityAuth): Promise<Response> => {
  const body = (await request
    .clone()
    .json()
    .catch(() => ({}))) as { email?: unknown; type?: unknown };
  const response = await auth.handler(request);
  if (!response.ok) return response;
  if (typeof body.email !== "string" || body.type !== "sign-in") return json({ error: "code_expiry_unavailable" }, 503);
  const context = await auth.$context;
  const verification = await context.internalAdapter.findVerificationValue(`sign-in-otp-${body.email.toLowerCase()}`);
  if (!verification) return json({ error: "code_expiry_unavailable" }, 503);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return Response.json(
    { ...((await response.json()) as Record<string, unknown>), expires_at: verification.expiresAt.getTime() / 1000 },
    { status: response.status, headers },
  );
};

/**
 * Sessions always expose the current link, with no cached eligibility state. The app reads its session each time it
 * opens, so this is where the browser gets its id and where the account's visit, and the browser it was on, are written.
 */
const accountSession = async (request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> => {
  const response = await auth.handler(request);
  const body = await response.text();
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  const browser = keepBrowser(request, headers);
  const user = (JSON.parse(body || "null") as { user?: { id?: unknown; realmsId?: unknown } } | null)?.user;
  if (response.ok && typeof user?.id === "string" && typeof user.realmsId === "string")
    await db.batch([noteVisit(db, user.id, Date.now()), noteBrowser(db, user.realmsId, browser)]);
  return new Response(body, { status: response.status, headers });
};

/** Writes the account's last visit, at most once per VISIT_RECORD_SECONDS so a page load costs no write most times. */
const noteVisit = (db: D1Database, userId: string, now: number) =>
  db
    .prepare(
      `UPDATE "user" SET "lastSeenAt" = ?1 WHERE "id" = ?2 AND ("lastSeenAt" IS NULL OR "lastSeenAt" <= ?1 - ?3)`,
    )
    .bind(now, userId, VISIT_RECORD_SECONDS * 1000);
