import { describe, expect, test } from "bun:test";
import { createGameStackProvisioningHandler, type GameStackProvisioningDependencies } from "../game-stack";
import type { GameStack } from "../game-stack/types";

describe("game-stack provisioning service boundary", () => {
  test("rejects unauthenticated dispatch before invoking the orchestrator", async () => {
    const events: string[] = [];
    const handler = createGameStackProvisioningHandler({
      serviceToken: "service-secret",
      provisioning: createProvisioningDependencies(events),
    });

    const response = await handler(buildProvisioningRequest({ authorization: "Bearer wrong" }));

    expect(response.status).toBe(401);
    expect(events).toEqual([]);
  });

  test("authenticates the immutable dispatch identity and runs the readiness orchestrator", async () => {
    const events: string[] = [];
    const handler = createGameStackProvisioningHandler({
      serviceToken: "service-secret",
      provisioning: createProvisioningDependencies(events),
    });

    const response = await handler(buildProvisioningRequest());
    const provisioned = (await response.json()) as GameStack;

    expect(response.status).toBe(200);
    expect(provisioned.operationalPhase).toBe("ready");
    expect(events.at(-2)).toBe("publish");
    expect(events.at(-1)).toBe("persist:ready");
  });
});

function buildProvisioningRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://orchestrator.example/v1/blitz/game-stacks/blitz-season-42/provisioning", {
    method: "POST",
    headers: {
      authorization: "Bearer service-secret",
      "content-type": "application/json",
      "idempotency-key": "blitz-season-42",
      ...headers,
    },
    body: JSON.stringify(requestedStack()),
  });
}

function requestedStack(): GameStack {
  return {
    schemaVersion: 1,
    gameStackId: "blitz-season-42",
    deploymentId: "0x4242",
    requesterWallet: "0x1234",
    quoteId: "0x99",
    presetId: "blitz-open",
    intendedStart: "2026-07-18T13:00:00.000Z",
    intendedEnd: "2026-07-18T14:30:00.000Z",
    readinessDeadline: "2026-07-18T12:45:00.000Z",
    rulesetId: "0x77",
    releaseBundleHash: "0x88",
    protocolLifecycle: "Intent",
    operationalPhase: "reserving",
    createdAt: "2026-07-18T10:20:00.000Z",
    updatedAt: "2026-07-18T10:20:00.000Z",
  };
}

function createProvisioningDependencies(events: string[]): GameStackProvisioningDependencies {
  let tick = Date.parse("2026-07-18T12:40:00.000Z");
  return {
    now: () => new Date(tick++),
    acceptSeasonIntent: async () => events.push("accept"),
    provisionKatana: async () => ({
      chainId: "0x534e5f424c49545a",
      runtimeName: "blitz-season-42-katana",
      runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
      imageDigest: `sha256:${"a".repeat(64)}`,
      endpoints: { rpc: "https://runtime.example/katana/rpc/v0_9" },
    }),
    sealKatanaIdentity: async () => events.push("seal"),
    verifyKatanaAttestation: async () => `sha384:${"c".repeat(96)}`,
    deployWorld: async () => "0x9876",
    provisionTorii: async () => ({
      runtimeName: "blitz-season-42-torii",
      runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
      imageDigest: `sha256:${"b".repeat(64)}`,
      endpoints: {
        base: "https://runtime.example/torii",
        sql: "https://runtime.example/torii/sql",
      },
    }),
    verifyIndexerReadiness: async () => events.push("indexer"),
    verifyRegistryAvailability: async () => events.push("registry"),
    assertProductionReleaseAuthorized: async () => events.push("authorize-production"),
    publishReadyGameStack: async () => {
      events.push("publish");
      return 42;
    },
    removeReadyGameStackPublication: async () => events.push("remove-publication"),
    persistTransition: async (_expected, next) => events.push(`persist:${next.operationalPhase}`),
    abortProvisioning: async () => events.push("abort"),
    releaseAdmission: async () => events.push("release"),
  };
}
