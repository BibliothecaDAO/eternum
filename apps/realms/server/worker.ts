import { createIdentityAuth, type IdentityAuth } from "./auth";
import { superviseNotifiers } from "./directory";
import { decodeIdentityEnv, type IdentityEnv } from "./env";
import { routeIdentityRequest } from "./routes";

/**
 * The identity Worker, served under the app's /api: better-auth owns /api/auth/*, and the rest are the account's
 * device approvals, public profiles, notification settings and our directory of shards.
 */
export default {
  fetch(request: Request, rawEnv: Record<string, unknown>): Promise<Response> {
    const env = decodeIdentityEnv(rawEnv);
    return routeIdentityRequest(request, env, identityAuthOf(rawEnv, env), {
      cache: caches.default,
      fetchShard: fetch,
      readLaunchDirectory: () => fetchLaunchDirectory(env.BASE_URL),
    });
  },
  async scheduled(_controller: ScheduledController, rawEnv: Record<string, unknown>): Promise<void> {
    const env = decodeIdentityEnv(rawEnv);
    await superviseNotifiers(env.DB, env.SHARD_NOTIFIER);
  },
};

/** Reads completed game ids from the launch service beside this Worker on the same app origin. */
const fetchLaunchDirectory = async (baseUrl: string) => {
  const response = await fetch(new URL("/api/factory/directory-games", baseUrl), {
    signal: AbortSignal.timeout(5_000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`Launch directory answered ${response.status}`);
  return (await response.json()) as { chains: { chainId: string; gameIds: number[] }[] };
};

export { ChatInbox } from "./chat/chat-inbox";
export { ChatRoom } from "./chat/chat-room";
export { ShardNotifier } from "./shard-notifier";

// One auth instance per isolate and environment; better-auth holds no per-request state.
const authByEnv = new WeakMap<object, IdentityAuth>();
const identityAuthOf = (rawEnv: object, env: IdentityEnv): IdentityAuth => {
  const cached = authByEnv.get(rawEnv);
  if (cached) return cached;
  const auth = createIdentityAuth(env);
  authByEnv.set(rawEnv, auth);
  return auth;
};
