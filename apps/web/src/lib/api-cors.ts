import { env } from "env";

type ApiHandler = () => Promise<Response> | Response;

const CORS_HEADERS = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": env.VITE_PUBLIC_GAME_ORIGIN,
};

export async function handleApiCors(request: Request, handler?: ApiHandler): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return withCorsHeaders(Response.json({ error: "Origin not allowed" }, { status: 403 }));
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (!handler) {
    return withCorsHeaders(Response.json({ error: "Method not allowed" }, { status: 405 }));
  }
  return withCorsHeaders(await handler());
}

function isAllowedOrigin(origin: string | null): boolean {
  return origin === null || origin === env.VITE_BASE_URL || origin === env.VITE_PUBLIC_GAME_ORIGIN;
}

function withCorsHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
