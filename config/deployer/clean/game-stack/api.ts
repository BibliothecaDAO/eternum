import { createBlitzAuthChallenge, type BlitzAuthChallenge } from "./auth";
import { createBlitzLaunchQuote } from "./policy";
import { deriveGameStackOperationalPhase, type BlitzLaunchQuote, type FailedGameStack, type GameStack } from "./types";

export interface FinalizedSeasonIntent {
  deploymentId: string;
  creator: string;
  status: "Intent";
  finalized: boolean;
  funded: boolean;
  presetId: BlitzLaunchQuote["presetId"];
  intendedStart: string;
  intendedEnd: string;
  rulesetId: string;
  releaseBundleHash: string;
}

export interface GameStackApiStore {
  saveChallenge(challenge: BlitzAuthChallenge): Promise<void>;
  readChallenge(challengeId: string): Promise<BlitzAuthChallenge | undefined>;
  consumeChallengeAndSaveQuote(challengeId: string, quote: BlitzLaunchQuote): Promise<void>;
  readQuote(quoteId: string): Promise<BlitzLaunchQuote | undefined>;
  acquireGameStack(challengeId: string, gameStack: GameStack): Promise<void>;
  failGameStack(gameStack: GameStack): Promise<void>;
  releaseGameStack(gameStackId: string): Promise<void>;
  readGameStack(gameStackId: string): Promise<GameStack | undefined>;
  readActiveGameStack(): Promise<GameStack | undefined>;
}

export interface GameStackApiDependencies {
  store: GameStackApiStore;
  generateFeltId(): string;
  generateGameStackId(): string;
  now(): Date;
  verifySignature(challenge: BlitzAuthChallenge, signature: string[]): Promise<boolean>;
  readFinalizedSeasonIntent(deploymentId: string): Promise<FinalizedSeasonIntent>;
  startProvisioning(gameStack: GameStack): Promise<void>;
}

export class GameStackStoreConflictError extends Error {}

export async function handleGameStackApiRequest(
  request: Request,
  dependencies: GameStackApiDependencies,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/v1/auth/challenges") {
      return await handleCreateChallenge(request, dependencies);
    }
    if (request.method === "POST" && url.pathname === "/v1/blitz/launch-quotes") {
      return await handleCreateLaunchQuote(request, dependencies);
    }
    if (request.method === "POST" && url.pathname === "/v1/blitz/game-stacks") {
      return await handleCreateGameStack(request, dependencies);
    }
    if (request.method === "GET" && url.pathname === "/v1/blitz/active") {
      return await handleReadActiveGameStack(dependencies);
    }

    const gameStackId = matchGameStackId(url.pathname);
    if (request.method === "GET" && gameStackId) {
      return await handleReadGameStack(gameStackId, dependencies);
    }
    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof GameStackApiError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    if (error instanceof GameStackStoreConflictError) {
      return jsonResponse({ error: error.message }, 409);
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
}

async function handleCreateChallenge(request: Request, dependencies: GameStackApiDependencies): Promise<Response> {
  const body = await readObjectBody(request);
  const requesterWallet = requireString(body.requesterWallet, "requesterWallet");
  const action = body.action;
  if (action !== "create-launch-quote" && action !== "create-game-stack") {
    throw new GameStackApiError(400, "action must be create-launch-quote or create-game-stack");
  }
  const payload = requireObject(body.payload, "payload");
  validateChallengePayload(action, payload);

  const challenge = createBlitzAuthChallenge({
    challengeId: dependencies.generateFeltId(),
    requesterWallet,
    action,
    payload,
    now: dependencies.now(),
  });
  await dependencies.store.saveChallenge(challenge);
  return jsonResponse(challenge, 201);
}

async function handleCreateLaunchQuote(request: Request, dependencies: GameStackApiDependencies): Promise<Response> {
  const challenge = await authenticateRequest(request, "create-launch-quote", dependencies);
  const activeGameStack = await dependencies.store.readActiveGameStack();
  if (activeGameStack) {
    throw new GameStackApiError(409, `Blitz admission is occupied by game stack "${activeGameStack.gameStackId}"`);
  }

  const quote = createBlitzLaunchQuote({
    quoteId: dependencies.generateFeltId(),
    requesterWallet: challenge.requesterWallet,
    presetId: requireString(challenge.payload.presetId, "presetId"),
    now: dependencies.now(),
  });
  await dependencies.store.consumeChallengeAndSaveQuote(challenge.challengeId, quote);
  return jsonResponse(quote, 201);
}

async function handleCreateGameStack(request: Request, dependencies: GameStackApiDependencies): Promise<Response> {
  const challenge = await authenticateRequest(request, "create-game-stack", dependencies);
  const quote = await resolveAuthenticatedLaunchQuote(challenge, dependencies);
  const deploymentId = requireString(challenge.payload.deploymentId, "deploymentId");
  const intent = await dependencies.readFinalizedSeasonIntent(deploymentId);
  assertIntentMatchesQuote(intent, quote, deploymentId);
  const gameStack = buildRequestedGameStack(quote, intent, dependencies);
  await dependencies.store.acquireGameStack(challenge.challengeId, gameStack);
  await startGameStackProvisioning(gameStack, dependencies);
  return jsonResponse(gameStack, 202);
}

async function startGameStackProvisioning(gameStack: GameStack, dependencies: GameStackApiDependencies): Promise<void> {
  try {
    await dependencies.startProvisioning(gameStack);
  } catch (error) {
    const failedGameStack = buildProvisioningDispatchFailure(gameStack, error, dependencies.now());
    await dependencies.store.failGameStack(failedGameStack);
    throw new GameStackApiError(502, `Game-stack provisioning could not start: ${failedGameStack.failure.message}`);
  }
}

async function handleReadGameStack(gameStackId: string, dependencies: GameStackApiDependencies): Promise<Response> {
  const gameStack = await dependencies.store.readGameStack(gameStackId);
  return gameStack ? jsonResponse(gameStack) : jsonResponse({ error: "Game stack not found" }, 404);
}

async function handleReadActiveGameStack(dependencies: GameStackApiDependencies): Promise<Response> {
  const gameStack = await dependencies.store.readActiveGameStack();
  return gameStack ? jsonResponse(gameStack) : jsonResponse({ error: "No active Blitz game stack" }, 404);
}

async function authenticateRequest(
  request: Request,
  expectedAction: BlitzAuthChallenge["action"],
  dependencies: GameStackApiDependencies,
): Promise<BlitzAuthChallenge> {
  const body = await readObjectBody(request);
  const challengeId = requireString(body.challengeId, "challengeId");
  const signature = requireStringArray(body.signature, "signature");
  const challenge = await dependencies.store.readChallenge(challengeId);
  if (!challenge || Date.parse(challenge.expiresAt) <= dependencies.now().getTime()) {
    throw new GameStackApiError(401, "Authentication challenge is missing or expired");
  }
  if (challenge.action !== expectedAction) {
    throw new GameStackApiError(401, "Authentication challenge is bound to another action");
  }
  if (!(await dependencies.verifySignature(challenge, signature))) {
    throw new GameStackApiError(401, "Controller signature is invalid");
  }
  return challenge;
}

async function resolveAuthenticatedLaunchQuote(
  challenge: BlitzAuthChallenge,
  dependencies: GameStackApiDependencies,
): Promise<BlitzLaunchQuote> {
  const quoteId = requireString(challenge.payload.quoteId, "quoteId");
  const quote = await dependencies.store.readQuote(quoteId);
  if (!quote || Date.parse(quote.expiresAt) <= dependencies.now().getTime()) {
    throw new GameStackApiError(409, "Launch quote is missing or expired");
  }
  if (!sameFelt(quote.requesterWallet, challenge.requesterWallet)) {
    throw new GameStackApiError(403, "Launch quote belongs to another wallet");
  }
  return quote;
}

function buildRequestedGameStack(
  quote: BlitzLaunchQuote,
  intent: FinalizedSeasonIntent,
  dependencies: GameStackApiDependencies,
): GameStack {
  const now = dependencies.now().toISOString();
  return {
    schemaVersion: 1,
    gameStackId: dependencies.generateGameStackId(),
    deploymentId: intent.deploymentId,
    requesterWallet: quote.requesterWallet,
    quoteId: quote.quoteId,
    presetId: quote.presetId,
    intendedStart: quote.intendedStart,
    intendedEnd: quote.intendedEnd,
    readinessDeadline: quote.readinessDeadline,
    rulesetId: intent.rulesetId,
    releaseBundleHash: intent.releaseBundleHash,
    protocolLifecycle: "Intent",
    operationalPhase: deriveGameStackOperationalPhase("Intent"),
    createdAt: now,
    updatedAt: now,
  };
}

function buildProvisioningDispatchFailure(gameStack: GameStack, error: unknown, failedAt: Date): FailedGameStack {
  const message = error instanceof Error ? error.message : String(error);
  const failedAtIso = failedAt.toISOString();
  return {
    ...gameStack,
    protocolLifecycle: "ProvisioningAborted",
    operationalPhase: deriveGameStackOperationalPhase("ProvisioningAborted", true),
    failure: {
      classification: "provisioning-dispatch",
      message,
      failedAt: failedAtIso,
      retryable: true,
      step: "start-provisioning",
    },
    updatedAt: failedAtIso,
  };
}

function assertIntentMatchesQuote(intent: FinalizedSeasonIntent, quote: BlitzLaunchQuote, deploymentId: string): void {
  if (!intent.finalized || !intent.funded || intent.status !== "Intent") {
    throw new GameStackApiError(409, "Season intent is not a finalized unaccepted intent");
  }
  if (!sameFelt(intent.deploymentId, deploymentId)) {
    throw new GameStackApiError(409, "Season intent deployment identity is inconsistent");
  }
  if (!sameFelt(intent.creator, quote.requesterWallet)) {
    throw new GameStackApiError(403, "Season intent belongs to another wallet");
  }
  if (intent.intendedStart !== quote.intendedStart || intent.intendedEnd !== quote.intendedEnd) {
    throw new GameStackApiError(409, "Season intent gameplay window does not match the approved quote");
  }
  if (intent.presetId !== quote.presetId) {
    throw new GameStackApiError(409, "Season intent preset does not match the approved quote");
  }
  if (!intent.rulesetId || !intent.releaseBundleHash) {
    throw new GameStackApiError(409, "Season intent is missing approved ruleset or release identity");
  }
}

function validateChallengePayload(action: BlitzAuthChallenge["action"], payload: Record<string, unknown>): void {
  if (action === "create-launch-quote") {
    requireString(payload.presetId, "payload.presetId");
    return;
  }
  requireString(payload.quoteId, "payload.quoteId");
  requireString(payload.deploymentId, "payload.deploymentId");
}

async function readObjectBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return requireObject(await request.json(), "request body");
  } catch (error) {
    if (error instanceof GameStackApiError) throw error;
    throw new GameStackApiError(400, "Request body must be valid JSON");
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GameStackApiError(400, `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GameStackApiError(400, `${label} is required`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string")) {
    throw new GameStackApiError(400, `${label} must be a non-empty string array`);
  }
  return value as string[];
}

function matchGameStackId(pathname: string): string | undefined {
  const match = /^\/v1\/blitz\/game-stacks\/([^/]+)$/.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, { status });
}

class GameStackApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
