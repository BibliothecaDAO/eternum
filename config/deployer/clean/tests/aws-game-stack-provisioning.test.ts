import { describe, expect, test } from "bun:test";
import { getEmbeddedReadOnlyRuntimeRegistry } from "../../../../common/factory/runtime-registry";
import type { GameStack } from "../game-stack";
import { createAwsGameStackProvisioningServiceHandler } from "../runtime/aws/game-stack-provisioning";

const REQUESTED_STACK: GameStack = {
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

describe("deployable AWS game-stack provisioning service", () => {
  test("runs each ordered responsibility through an identity-bound idempotent operation", async () => {
    const operationRequests: Array<{ operation: string; idempotencyKey: string }> = [];
    const dynamoCommands: string[][] = [];
    let registry = getEmbeddedReadOnlyRuntimeRegistry();
    let tick = Date.parse("2026-07-18T12:40:00.000Z");
    const handler = createAwsGameStackProvisioningServiceHandler(
      {
        tableName: "runtime-control",
        region: "us-east-2",
        operationsUrl: "https://operations.example",
        registryUrl: "https://registry.example/api/runtime-registry/v1",
        registryAdminSecret: "registry-secret",
        serviceToken: "service-secret",
      },
      {
        commandRunner: (args) => {
          dynamoCommands.push(args);
          return { status: 0, stdout: "", stderr: "" } as never;
        },
        now: () => new Date(tick++),
        assertProductionReleaseAuthorized: () => {},
        fetchImpl: async (input, init) => {
          const url = new URL(String(input));
          if (url.origin === "https://registry.example") {
            if (init?.method === "POST") {
              registry = JSON.parse(String(init.body)).registry;
              return Response.json(registry);
            }
            return Response.json(registry);
          }
          const operation = url.pathname.split("/").at(-1)!;
          operationRequests.push({
            operation,
            idempotencyKey: new Headers(init?.headers).get("idempotency-key") || "",
          });
          return operationResponse(operation);
        },
      },
    );

    const response = await handler(provisioningRequest());
    const provisioned = (await response.json()) as GameStack;

    expect(response.status).toBe(200);
    expect(operationRequests).toEqual([
      { operation: "accept-season-intent", idempotencyKey: "blitz-season-42:accept-season-intent" },
      { operation: "provision-katana", idempotencyKey: "blitz-season-42:provision-katana" },
      { operation: "seal-katana-identity", idempotencyKey: "blitz-season-42:seal-katana-identity" },
      { operation: "verify-katana-attestation", idempotencyKey: "blitz-season-42:verify-katana-attestation" },
      { operation: "deploy-world", idempotencyKey: "blitz-season-42:deploy-world" },
      { operation: "provision-torii", idempotencyKey: "blitz-season-42:provision-torii" },
      { operation: "verify-indexer-readiness", idempotencyKey: "blitz-season-42:verify-indexer-readiness" },
    ]);
    expect(provisioned).toMatchObject({ operationalPhase: "ready", publicationRevision: 2 });
    expect(registry.activeGameStacks?.["mainnet.blitz"]?.gameStackId).toBe("blitz-season-42");
    expect(dynamoCommands.filter((args) => args[1] === "update-item")).toHaveLength(6);
  });

  test("fails before orchestration when service authentication is absent", async () => {
    let called = false;
    const handler = createAwsGameStackProvisioningServiceHandler(
      {
        tableName: "runtime-control",
        region: "us-east-2",
        operationsUrl: "https://operations.example",
        registryUrl: "https://registry.example/api/runtime-registry/v1",
        registryAdminSecret: "registry-secret",
        serviceToken: "service-secret",
      },
      {
        commandRunner: () => {
          called = true;
          return { status: 0, stdout: "", stderr: "" } as never;
        },
        fetchImpl: async () => {
          called = true;
          return Response.json({});
        },
      },
    );

    const response = await handler(provisioningRequest({ authorization: "Bearer wrong" }));

    expect(response.status).toBe(401);
    expect(called).toBeFalse();
  });
});

function provisioningRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://orchestrator.example/v1/blitz/game-stacks/blitz-season-42/provisioning", {
    method: "POST",
    headers: {
      authorization: "Bearer service-secret",
      "content-type": "application/json",
      "idempotency-key": "blitz-season-42",
      ...headers,
    },
    body: JSON.stringify(REQUESTED_STACK),
  });
}

function operationResponse(operation: string): Response {
  if (operation === "provision-katana") {
    return Response.json({
      runtimeName: "blitz-season-42",
      runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
      imageDigest: `sha256:${"a".repeat(64)}`,
      routingShard: 0,
      chainId: "0x534e5f424c49545a",
      endpoints: {
        base: "https://runtime.example/katana",
        health: "https://runtime.example/katana/health",
        rpc: "https://runtime.example/katana/rpc/v0_9",
      },
    });
  }
  if (operation === "verify-katana-attestation") {
    return Response.json({ attestationMeasurement: `sha384:${"c".repeat(96)}` });
  }
  if (operation === "deploy-world") return Response.json({ worldAddress: "0x9876" });
  if (operation === "provision-torii") {
    return Response.json({
      runtimeName: "blitz-season-42",
      runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
      imageDigest: `sha256:${"b".repeat(64)}`,
      routingShard: 0,
      endpoints: {
        base: "https://runtime.example/torii",
        health: "https://runtime.example/torii/health",
        sql: "https://runtime.example/torii/sql",
      },
    });
  }
  return Response.json({ ok: true });
}
