import { auth } from "./auth";
import { handleApiCors } from "./api-cors";
import {
  BindGameplayAccountInput,
  RotateGameplayAccountInput,
  bindGameplayAccount,
  gameplayAccountOf,
  rotateGameplayAccountKey,
} from "./binding";
import { leaderboardPopulation, namesByOwners } from "./names";
import { serverEnv } from "./env";
import { serveStatic } from "./static";

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

const handleGameplayAccountAction = async (request: Request, action: string): Promise<Response> => {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) return json({ error: "Authentication required" }, 401);
  if (!isGameplayAccountAction(action)) return json({ error: "not_found" }, 404);

  try {
    const input: unknown = await request.json();
    if (action === "bind") {
      return json(await bindGameplayAccount({ owner: session.user.id, ...BindGameplayAccountInput.parse(input) }));
    }
    return json(
      await rotateGameplayAccountKey({
        owner: session.user.id,
        sessionId: session.session.id,
        ...RotateGameplayAccountInput.parse(input),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gameplay account request failed";
    return json({ error: message }, 400);
  }
};

const handleApiRequest = async (request: Request, url: URL): Promise<Response> => {
  try {
    if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) return auth.handler(request);

    if (request.method === "GET") {
      if (url.pathname === "/api/names") return handleNames(url);
      if (url.pathname === "/api/leaderboard") return handleLeaderboard();
      if (url.pathname === "/api/gameplay-account") return handleGameplayAccount(request);
    }

    const gameplayAction = /^\/api\/gameplay-account\/([^/]+)$/.exec(url.pathname)?.[1];
    if (request.method === "POST" && gameplayAction) {
      return handleGameplayAccountAction(request, gameplayAction);
    }

    return json({ error: "not_found" }, 404);
  } catch (error) {
    console.error("realms-identity request failed", url.pathname, error);
    return json({ error: "internal" }, 500);
  }
};

const isGameplayAccountAction = (action: string): action is "bind" | "rotate" =>
  action === "bind" || action === "rotate";

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return handleApiCors(request, () => handleApiRequest(request, url));
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    if (url.pathname === "/health") return json({ service: "realms-identity", success: true });
    return await serveStatic(url, request.method);
  } catch (error) {
    console.error("realms-identity request failed", url.pathname, error);
    return json({ error: "internal" }, 500);
  }
}

if (import.meta.main) {
  const server = Bun.serve({
    port: serverEnv.REALMS_SERVER_PORT,
    fetch: handleRequest,
  });
  console.info(`realms identity server listening on :${server.port}`);
}
