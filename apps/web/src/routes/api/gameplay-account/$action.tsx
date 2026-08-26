import {
  BindGameplayAccountInput,
  RotateGameplayAccountInput,
  bindGameplayAccount,
  rotateGameplayAccountKey,
} from "@/lib/gameplay-account";
import { auth } from "@/utils/auth";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "env";

const corsHeaders = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": env.VITE_PUBLIC_GAME_ORIGIN,
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

export const Route = createFileRoute("/api/gameplay-account/$action")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: ({ request, params }) => handleGameplayAccountRequest(request, params.action),
    },
  },
});

async function handleGameplayAccountRequest(request: Request, action: string): Promise<Response> {
  if (request.headers.get("origin") !== env.VITE_PUBLIC_GAME_ORIGIN) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return json({ error: "Authentication required" }, 401);
  }
  if (!isGameplayAccountAction(action)) {
    return json({ error: "Not found" }, 404);
  }

  try {
    const result = await runGameplayAccountAction({
      action,
      input: await request.json(),
      owner: session.user.id,
      sessionId: session.session.id,
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gameplay account request failed";
    return json({ error: message }, 400);
  }
}

async function runGameplayAccountAction({
  action,
  input,
  owner,
  sessionId,
}: {
  action: "bind" | "rotate";
  input: unknown;
  owner: string;
  sessionId: string;
}) {
  if (action === "bind") {
    return bindGameplayAccount({ owner, ...BindGameplayAccountInput.parse(input) });
  }
  return rotateGameplayAccountKey({ owner, sessionId, ...RotateGameplayAccountInput.parse(input) });
}

function isGameplayAccountAction(action: string): action is "bind" | "rotate" {
  return action === "bind" || action === "rotate";
}
