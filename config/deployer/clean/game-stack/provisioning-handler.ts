import { provisionGameStack, type GameStackProvisioningDependencies } from "./orchestrator";
import type { GameStack } from "./types";

export interface GameStackProvisioningHandlerConfig {
  serviceToken: string;
  provisioning: GameStackProvisioningDependencies;
}

export function createGameStackProvisioningHandler(
  config: GameStackProvisioningHandlerConfig,
): (request: Request) => Promise<Response> {
  if (!config.serviceToken.trim()) throw new Error("Game-stack provisioning handler requires a service token");
  return (request) => handleProvisioningRequest(request, config);
}

async function handleProvisioningRequest(
  request: Request,
  config: GameStackProvisioningHandlerConfig,
): Promise<Response> {
  try {
    const gameStackId = matchProvisioningPath(new URL(request.url).pathname);
    if (request.method !== "POST" || !gameStackId) return jsonResponse({ error: "Not found" }, 404);
    authorizeProvisioningRequest(request, gameStackId, config.serviceToken);
    const gameStack = await readRequestedGameStack(request, gameStackId);
    return jsonResponse(await provisionGameStack(gameStack, config.provisioning));
  } catch (error) {
    if (error instanceof ProvisioningRequestError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

function authorizeProvisioningRequest(request: Request, gameStackId: string, serviceToken: string): void {
  if (request.headers.get("authorization") !== `Bearer ${serviceToken}`) {
    throw new ProvisioningRequestError(401, "Game-stack provisioning authorization is invalid");
  }
  if (request.headers.get("idempotency-key") !== gameStackId) {
    throw new ProvisioningRequestError(400, "Idempotency-Key must equal the immutable game-stack ID");
  }
}

async function readRequestedGameStack(request: Request, gameStackId: string): Promise<GameStack> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ProvisioningRequestError(400, "Provisioning request body must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProvisioningRequestError(400, "Provisioning request body must be a game stack");
  }
  const gameStack = value as Partial<GameStack>;
  if (gameStack.schemaVersion !== 1 || gameStack.gameStackId !== gameStackId) {
    throw new ProvisioningRequestError(400, "Provisioning request identity does not match its route");
  }
  return gameStack as GameStack;
}

function matchProvisioningPath(pathname: string): string | undefined {
  return /^\/v1\/blitz\/game-stacks\/([^/]+)\/provisioning$/.exec(pathname)?.[1];
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

class ProvisioningRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
