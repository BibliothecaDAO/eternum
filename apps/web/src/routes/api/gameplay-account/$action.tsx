import {
  BindGameplayAccountInput,
  RotateGameplayAccountInput,
  bindGameplayAccount,
  rotateGameplayAccountKey,
} from "@/lib/gameplay-account";
import { handleApiCors } from "@/lib/api-cors";
import { auth } from "@/utils/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gameplay-account/$action")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => handleApiCors(request),
      POST: ({ request, params }) => handleApiCors(request, () => handleGameplayAccountRequest(request, params.action)),
    },
  },
});

async function handleGameplayAccountRequest(request: Request, action: string): Promise<Response> {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isGameplayAccountAction(action)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await runGameplayAccountAction({
      action,
      input: await request.json(),
      owner: session.user.id,
      sessionId: session.session.id,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gameplay account request failed";
    return Response.json({ error: message }, { status: 400 });
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
