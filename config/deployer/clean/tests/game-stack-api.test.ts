import { describe, expect, test } from "bun:test";
import {
  GameStackStoreConflictError,
  handleGameStackApiRequest,
  type GameStackApiDependencies,
  type GameStackApiStore,
} from "../game-stack/api";
import type { BlitzAuthChallenge, BlitzLaunchQuote, GameStack } from "../game-stack";

function createMemoryStore(): GameStackApiStore & {
  challenges: Map<string, BlitzAuthChallenge>;
  quotes: Map<string, BlitzLaunchQuote>;
  gameStacks: Map<string, GameStack>;
  active?: string;
} {
  const challenges = new Map<string, BlitzAuthChallenge>();
  const quotes = new Map<string, BlitzLaunchQuote>();
  const gameStacks = new Map<string, GameStack>();
  return {
    challenges,
    quotes,
    gameStacks,
    async saveChallenge(challenge) {
      challenges.set(challenge.challengeId, challenge);
    },
    async readChallenge(challengeId) {
      return challenges.get(challengeId);
    },
    async consumeChallengeAndSaveQuote(challengeId, quote) {
      if (!challenges.has(challengeId)) throw new Error("challenge unavailable");
      quotes.set(quote.quoteId, quote);
    },
    async readQuote(quoteId) {
      return quotes.get(quoteId);
    },
    async acquireGameStack(_challengeId, gameStack) {
      gameStacks.set(gameStack.gameStackId, gameStack);
      this.active = gameStack.gameStackId;
    },
    async failGameStack(gameStack) {
      gameStacks.set(gameStack.gameStackId, gameStack);
      if (this.active === gameStack.gameStackId) this.active = undefined;
    },
    async releaseGameStack(gameStackId) {
      if (this.active === gameStackId) this.active = undefined;
    },
    async readGameStack(gameStackId) {
      return gameStacks.get(gameStackId);
    },
    async readActiveGameStack() {
      return this.active ? gameStacks.get(this.active) : undefined;
    },
  };
}

function createDependencies(store = createMemoryStore()): GameStackApiDependencies {
  let id = 0;
  return {
    store,
    now: () => new Date("2026-07-18T10:20:00.000Z"),
    generateFeltId: () => `0x${(++id).toString(16)}`,
    generateGameStackId: () => "018f6e54-5f4a-7ae2-a0ff-123456789abc",
    verifySignature: async (_challenge, signature) => signature[0] === "0xvalid",
    readFinalizedSeasonIntent: async (deploymentId) => ({
      deploymentId,
      creator: "0x1234",
      status: "Intent",
      finalized: true,
      funded: true,
      presetId: "blitz-open",
      intendedStart: "2026-07-18T13:00:00.000Z",
      intendedEnd: "2026-07-18T14:30:00.000Z",
      rulesetId: "0x77",
      releaseBundleHash: "0x88",
    }),
    assertProductionReleaseAuthorized: async () => {},
    startProvisioning: async () => {},
  };
}

async function postJson(path: string, body: unknown, dependencies: GameStackApiDependencies): Promise<Response> {
  return handleGameStackApiRequest(
    new Request(`https://launch.example${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    dependencies,
  );
}

describe("AWS Blitz game-stack API", () => {
  test("rejects an invalid Controller signature before creating a quote", async () => {
    const dependencies = createDependencies();
    const challengeResponse = await postJson(
      "/v1/auth/challenges",
      { requesterWallet: "0x1234", action: "create-launch-quote", payload: { presetId: "blitz-open" } },
      dependencies,
    );
    const challenge = await challengeResponse.json();

    const quoteResponse = await postJson(
      "/v1/blitz/launch-quotes",
      { challengeId: challenge.challengeId, signature: ["0xinvalid"] },
      dependencies,
    );

    expect(challengeResponse.status).toBe(201);
    expect(quoteResponse.status).toBe(401);
    expect(await quoteResponse.json()).toEqual({ error: "Controller signature is invalid" });
  });

  test("returns a conflict when an authenticated challenge loses an atomic consume race", async () => {
    const store = createMemoryStore();
    store.consumeChallengeAndSaveQuote = async () => {
      throw new GameStackStoreConflictError("Blitz authentication challenge was already consumed or expired");
    };
    const dependencies = createDependencies(store);
    const challenge = await (
      await postJson(
        "/v1/auth/challenges",
        { requesterWallet: "0x1234", action: "create-launch-quote", payload: { presetId: "blitz-open" } },
        dependencies,
      )
    ).json();

    const response = await postJson(
      "/v1/blitz/launch-quotes",
      { challengeId: challenge.challengeId, signature: ["0xvalid"] },
      dependencies,
    );

    expect(response.status).toBe(409);
  });

  test("creates a stack only from a matching finalized L1 intent and starts provisioning", async () => {
    const store = createMemoryStore();
    let provisioned: GameStack | undefined;
    const dependencies = {
      ...createDependencies(store),
      startProvisioning: async (gameStack: GameStack) => {
        provisioned = gameStack;
      },
    };

    const quoteChallenge = await (
      await postJson(
        "/v1/auth/challenges",
        { requesterWallet: "0x1234", action: "create-launch-quote", payload: { presetId: "blitz-open" } },
        dependencies,
      )
    ).json();
    const quote = await (
      await postJson(
        "/v1/blitz/launch-quotes",
        { challengeId: quoteChallenge.challengeId, signature: ["0xvalid"] },
        dependencies,
      )
    ).json();
    const stackChallenge = await (
      await postJson(
        "/v1/auth/challenges",
        {
          requesterWallet: "0x1234",
          action: "create-game-stack",
          payload: { quoteId: quote.quoteId, deploymentId: "0x4242" },
        },
        dependencies,
      )
    ).json();
    const stackResponse = await postJson(
      "/v1/blitz/game-stacks",
      { challengeId: stackChallenge.challengeId, signature: ["0xvalid"] },
      dependencies,
    );
    const stack = await stackResponse.json();

    expect(stackResponse.status).toBe(202);
    expect(stack).toMatchObject({
      gameStackId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
      requesterWallet: "0x1234",
      deploymentId: "0x4242",
      presetId: "blitz-open",
      intendedStart: "2026-07-18T13:00:00.000Z",
      intendedEnd: "2026-07-18T14:30:00.000Z",
      protocolLifecycle: "Intent",
      operationalPhase: "reserving",
    });
    expect(provisioned).toEqual(stack);

    const activeResponse = await handleGameStackApiRequest(
      new Request("https://launch.example/v1/blitz/active"),
      dependencies,
    );
    expect(activeResponse.status).toBe(404);
    expect(await activeResponse.json()).toEqual({ error: "No published active Blitz game stack" });

    const publishedStack: GameStack = {
      ...stack,
      l3ChainId: "0x534e5f424c49545a",
      worldAddress: "0x9876",
      attestationMeasurement: `sha384:${"c".repeat(96)}`,
      katana: {
        runtimeName: "blitz-season-42-katana",
        runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
        imageDigest: `sha256:${"a".repeat(64)}`,
        endpoints: { rpc: "https://runtime.example/katana/rpc/v0_9" },
      },
      torii: {
        runtimeName: "blitz-season-42-torii",
        runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
        imageDigest: `sha256:${"b".repeat(64)}`,
        endpoints: {
          base: "https://runtime.example/torii",
          sql: "https://runtime.example/torii/sql",
        },
      },
      readiness: {
        identitySealedAt: "2026-07-18T10:20:00.000Z",
        attestationVerifiedAt: "2026-07-18T10:20:00.000Z",
        worldReadyAt: "2026-07-18T10:20:00.000Z",
        indexerReadyAt: "2026-07-18T10:20:00.000Z",
        registryVerifiedAt: "2026-07-18T10:20:00.000Z",
      },
      protocolLifecycle: "Attested",
      operationalPhase: "ready",
      publicationRevision: 42,
    };
    store.gameStacks.set(publishedStack.gameStackId, publishedStack);
    const publishedResponse = await handleGameStackApiRequest(
      new Request("https://launch.example/v1/blitz/active"),
      dependencies,
    );
    expect(publishedResponse.status).toBe(200);
    expect(await publishedResponse.json()).toEqual(publishedStack);
  });

  test("releases admission when provisioning dispatch fails", async () => {
    const store = createMemoryStore();
    const dependencies = {
      ...createDependencies(store),
      startProvisioning: async () => {
        throw new Error("workflow unavailable");
      },
    };
    const quote = {
      schemaVersion: 1 as const,
      quoteId: "0x99",
      requesterWallet: "0x1234",
      presetId: "blitz-open" as const,
      durationSeconds: 5_400,
      twoPlayerMode: false,
      intendedStart: "2026-07-18T13:00:00.000Z",
      intendedEnd: "2026-07-18T14:30:00.000Z",
      readinessDeadline: "2026-07-18T12:45:00.000Z",
      expiresAt: "2026-07-18T10:50:00.000Z",
    };
    store.quotes.set(quote.quoteId, quote);
    const challengeResponse = await postJson(
      "/v1/auth/challenges",
      {
        requesterWallet: "0x1234",
        action: "create-game-stack",
        payload: { quoteId: quote.quoteId, deploymentId: "0x4242" },
      },
      dependencies,
    );
    const challenge = await challengeResponse.json();

    const response = await postJson(
      "/v1/blitz/game-stacks",
      { challengeId: challenge.challengeId, signature: ["0xvalid"] },
      dependencies,
    );

    expect(response.status).toBe(502);
    expect(store.active).toBeUndefined();
    expect([...store.gameStacks.values()][0]).toMatchObject({
      protocolLifecycle: "ProvisioningAborted",
      operationalPhase: "failed",
      failure: {
        classification: "provisioning-dispatch",
        message: "workflow unavailable",
        step: "start-provisioning",
      },
    });
  });
});
