import { describe, expect, test } from "bun:test";
import {
  createGameStackApiHandler,
  type BlitzAuthChallenge,
  type BlitzLaunchQuote,
  type GameStack,
  type GameStackApiStore,
} from "../game-stack";
import { createAwsGameStackApiHandler } from "../runtime/aws/game-stack-api";

function createMemoryStore(): GameStackApiStore {
  const challenges = new Map<string, BlitzAuthChallenge>();
  const quotes = new Map<string, BlitzLaunchQuote>();
  const stacks = new Map<string, GameStack>();
  let activeStackId: string | undefined;
  return {
    async saveChallenge(challenge) {
      challenges.set(challenge.challengeId, challenge);
    },
    async readChallenge(id) {
      return challenges.get(id);
    },
    async consumeChallengeAndSaveQuote(challengeId, quote) {
      challenges.delete(challengeId);
      quotes.set(quote.quoteId, quote);
    },
    async readQuote(id) {
      return quotes.get(id);
    },
    async acquireGameStack(challengeId, stack) {
      challenges.delete(challengeId);
      stacks.set(stack.gameStackId, stack);
      activeStackId = stack.gameStackId;
    },
    async failGameStack(stack) {
      stacks.set(stack.gameStackId, stack);
      activeStackId = undefined;
    },
    async releaseGameStack(id) {
      if (activeStackId === id) activeStackId = undefined;
    },
    async readGameStack(id) {
      return stacks.get(id);
    },
    async readActiveGameStack() {
      return activeStackId ? stacks.get(activeStackId) : undefined;
    },
  };
}

describe("deployable Blitz game-stack API handler", () => {
  test("binds the public handler to the authoritative AWS control table", async () => {
    const commands: string[][] = [];
    const handler = createAwsGameStackApiHandler(
      {
        tableName: "runtime-control",
        region: "us-east-2",
        mainnetRpcUrl: "https://rpc.example",
        seasonIntentReaderUrl: "https://intent.example",
        orchestratorUrl: "https://orchestrator.example",
        serviceToken: "service-token",
      },
      {
        commandRunner: (args) => {
          commands.push(args);
          return { status: 0, stdout: "", stderr: "" } as never;
        },
        now: () => new Date("2026-07-18T10:20:00.000Z"),
        randomUuid: () => "018f6e54-5f4a-7ae2-a0ff-123456789abc",
      },
    );

    const response = await handler(
      new Request("https://launch.example/v1/auth/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requesterWallet: "0x1234",
          action: "create-launch-quote",
          payload: { presetId: "blitz-open" },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain("put-item");
    expect(commands[0]).toContain("runtime-control");
    expect(commands[0]).toContain("us-east-2");
  });

  test("composes intent verification and idempotent provisioning dispatch behind the public routes", async () => {
    const calls: string[] = [];
    let id = 0;
    const handler = createGameStackApiHandler({
      store: createMemoryStore(),
      now: () => new Date("2026-07-18T10:20:00.000Z"),
      generateFeltId: () => `0x${(++id).toString(16)}`,
      generateGameStackId: () => "018f6e54-5f4a-7ae2-a0ff-123456789abc",
      verifySignature: async () => true,
      readFinalizedSeasonIntent: async (deploymentId) => {
        calls.push(`intent:${deploymentId}`);
        return {
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
        };
      },
      assertProductionReleaseAuthorized: async () => {},
      dispatchProvisioning: async (stack, idempotencyKey) => {
        calls.push(`dispatch:${stack.gameStackId}:${idempotencyKey}`);
      },
    });

    const quoteChallenge = await post(handler, "/v1/auth/challenges", {
      requesterWallet: "0x1234",
      action: "create-launch-quote",
      payload: { presetId: "blitz-open" },
    });
    const quote = await post(handler, "/v1/blitz/launch-quotes", {
      challengeId: quoteChallenge.challengeId,
      signature: ["0xvalid"],
    });
    const stackChallenge = await post(handler, "/v1/auth/challenges", {
      requesterWallet: "0x1234",
      action: "create-game-stack",
      payload: { quoteId: quote.quoteId, deploymentId: "0x4242" },
    });
    const stack = await post(handler, "/v1/blitz/game-stacks", {
      challengeId: stackChallenge.challengeId,
      signature: ["0xvalid"],
    });

    expect(stack.operationalPhase).toBe("reserving");
    expect(calls).toEqual([
      "intent:0x4242",
      "dispatch:018f6e54-5f4a-7ae2-a0ff-123456789abc:018f6e54-5f4a-7ae2-a0ff-123456789abc",
    ]);
  });
});

async function post(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown,
): Promise<Record<string, any>> {
  const response = await handler(
    new Request(`https://launch.example${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  expect(response.status).toBeLessThan(300);
  return response.json();
}
