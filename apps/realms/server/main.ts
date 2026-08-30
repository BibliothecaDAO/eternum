import { auth } from "./auth";
import { gameplayAccountOf } from "./binding";
import { leaderboardPopulation, namesByOwners } from "./names";
import { serverEnv } from "./env";

/**
 * The identity server for apps/realms, shaped like herald: one Bun fetch
 * handler, explicit routes, JSON in and out. better-auth owns /api/auth/*;
 * the rest are read models over identity and indexed history.
 */

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

const sessionOwner = async (request: Request): Promise<string | null> => {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
};

const handleNames = async (url: URL): Promise<Response> => {
  const raw = url.searchParams.get("owners") ?? "";
  const owners = raw
    .split(",")
    .map((owner) => owner.trim())
    .filter(Boolean);
  if (owners.length === 0 || owners.length > 200) {
    return json({ error: "owners must list 1 to 200 addresses" }, 400);
  }
  try {
    return json({ names: await namesByOwners(owners) });
  } catch {
    return json({ error: "owners must be Starknet addresses" }, 400);
  }
};

const handleLeaderboard = async (): Promise<Response> => json({ players: await leaderboardPopulation() });

const handleGameplayAccount = async (request: Request): Promise<Response> => {
  const owner = await sessionOwner(request);
  if (!owner) return json({ error: "unauthorized" }, 401);
  return json({ account: await gameplayAccountOf(owner) });
};

const server = Bun.serve({
  port: serverEnv.REALMS_SERVER_PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) return auth.handler(request);
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    try {
      if (url.pathname === "/api/names") return await handleNames(url);
      if (url.pathname === "/api/leaderboard") return await handleLeaderboard();
      if (url.pathname === "/api/gameplay-account") return await handleGameplayAccount(request);
      if (url.pathname === "/health") return json({ service: "realms-identity", success: true });
    } catch (error) {
      console.error("realms-identity request failed", url.pathname, error);
      return json({ error: "internal" }, 500);
    }
    return json({ error: "not_found" }, 404);
  },
});

console.info(`realms identity server listening on :${server.port}`);
