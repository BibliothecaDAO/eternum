import { serverEnv } from "./env";
import { isLoopbackOrigin } from "./loopback-origins";

type ApiHandler = () => Promise<Response> | Response;

const ALLOWED_ORIGINS = new Set([
  new URL(serverEnv.VITE_BASE_URL).origin,
  new URL(serverEnv.VITE_PUBLIC_GAME_ORIGIN).origin,
]);

export async function handleApiCors(request: Request, handler: ApiHandler): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin !== null && !isAllowedOrigin(origin)) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return withCorsHeaders(new Response(null, { status: 204 }), origin);
  }

  return withCorsHeaders(await handler(), origin);
}

const isAllowedOrigin = (origin: string): boolean => ALLOWED_ORIGINS.has(origin) || isLoopbackOrigin(origin);

function withCorsHeaders(response: Response, origin: string | null): Response {
  response.headers.set("access-control-allow-credentials", "true");
  response.headers.set("access-control-allow-headers", "content-type");
  response.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  response.headers.append("vary", "Origin");
  if (origin !== null) response.headers.set("access-control-allow-origin", origin);
  return response;
}
