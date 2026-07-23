import { describe, expect, test } from "bun:test";
import { getKatanaTeeReleaseProjection } from "@bibliothecadao/settlement-codec";
import { getEmbeddedReadOnlyRuntimeRegistry } from "../../../../common/factory/runtime-registry";
import {
  buildGameStackAttestationReportDataHash,
  GameStackPublicationAttemptError,
  type GameStack,
} from "../game-stack";
import type { AwsRuntimeRequest } from "../runtime/aws-runtime";
import {
  createAwsGameStackProvisioningDependencies,
  createAwsGameStackProvisioningServiceHandler,
} from "../runtime/aws/game-stack-provisioning";
import type { ObservedKatanaRuntimeArtifactV1 } from "../runtime/aws/katana-runtime-artifact";

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
  katanaTeeRelease: getKatanaTeeReleaseProjection(),
  protocolLifecycle: "Intent",
  operationalPhase: "reserving",
  createdAt: "2026-07-18T10:20:00.000Z",
  updatedAt: "2026-07-18T10:20:00.000Z",
};
const PINNED_ATTESTATION_MEASUREMENT = `sha384:${REQUESTED_STACK.katanaTeeRelease.launchMeasurement}`;
const KATANA_RUNTIME_INSTANCE_ID = "eb5c4dde-899c-8b9f-8c72-a8a2fd716d50";

describe("deployable AWS game-stack provisioning service", () => {
  test("runs each ordered responsibility through an identity-bound idempotent operation", async () => {
    const operationRequests: Array<{ operation: string; idempotencyKey: string }> = [];
    const registryRequests: string[] = [];
    const dynamoCommands: string[][] = [];
    let katanaDesiredRuntime: AwsRuntimeRequest | undefined;
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
            registryRequests.push(init?.method ?? "GET");
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
          const payload = JSON.parse(String(init?.body)) as OperationPayload;
          if (isKatanaProvisioningPayload(payload)) katanaDesiredRuntime = payload.desiredRuntime;
          return operationResponse(operation, payload);
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
    expect(registryRequests).toEqual(["GET", "GET", "POST", "GET"]);
    expect(dynamoCommands.filter((args) => args[1] === "update-item")).toHaveLength(6);
    expect(katanaDesiredRuntime).toMatchObject({
      environmentId: "mainnet.blitz",
      runtimeKind: "katana",
      runtimePlatform: "ec2-sev-snp",
      lifecycleClass: "ephemeral",
      exposurePolicy: "public-read",
      imageDigest: REQUESTED_STACK.katanaTeeRelease.vmAssetDigest,
      katanaTeeRelease: REQUESTED_STACK.katanaTeeRelease,
    });
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

  test("rejects a provisioner artifact whose observed platform differs from desired state", async () => {
    const dependencies = createAwsGameStackProvisioningDependencies(provisioningConfig(), {
      fetchImpl: async (_input, init) => {
        const payload = JSON.parse(String(init?.body)) as KatanaProvisioningPayload;
        const response = (await operationResponse("provision-katana", payload).json()) as {
          observedRuntime: ObservedKatanaRuntimeArtifactV1;
        };
        return Response.json({
          ...response,
          observedRuntime: { ...response.observedRuntime, runtimePlatform: "ecs-fargate" },
        });
      },
    });

    await expect(dependencies.provisionKatana(REQUESTED_STACK)).rejects.toThrow(
      "Observed Katana runtime requires runtimePlatform=ec2-sev-snp",
    );
  });

  test("rejects observed EC2 ownership and VM substitutions", async () => {
    for (const observedRuntime of [
      {
        ...observedKatanaRuntimeArtifact(),
        vmAssetDigest: `sha256:${"a".repeat(64)}`,
      },
      {
        ...observedKatanaRuntimeArtifact(),
        ownerTags: {
          ...observedKatanaRuntimeArtifact().ownerTags,
          RuntimeInstanceId: "aaaaaaaa-aaaa-8aaa-8aaa-aaaaaaaaaaaa",
        },
      },
    ]) {
      const dependencies = createAwsGameStackProvisioningDependencies(provisioningConfig(), {
        fetchImpl: async () => Response.json({ observedRuntime }),
      });

      await expect(dependencies.provisionKatana(REQUESTED_STACK)).rejects.toThrow(
        /Observed Katana runtime (does not match desired vmAssetDigest|owner tag does not match desired RuntimeInstanceId)/,
      );
    }
  });

  test("rejects observed EC2 evidence from another provisioning operation", async () => {
    const dependencies = provisioningDependenciesForObservedRuntime({
      ...observedKatanaRuntimeArtifact(),
      operationId: "blitz-season-42:provision-torii",
    });

    await expect(dependencies.provisionKatana(REQUESTED_STACK)).rejects.toThrow(
      "Observed Katana runtime does not match provisioning operation",
    );
  });

  test("rejects observed EC2 evidence captured before its provisioning request", async () => {
    const dependencies = provisioningDependenciesForObservedRuntime(
      {
        ...observedKatanaRuntimeArtifact(),
        observedAt: "2026-07-18T12:39:59.000Z",
      },
      ["2026-07-18T12:40:00.000Z", "2026-07-18T12:40:01.000Z"],
    );

    await expect(dependencies.provisionKatana(REQUESTED_STACK)).rejects.toThrow(
      "Observed Katana runtime predates its provisioning request",
    );
  });

  test("rejects stale observed EC2 evidence", async () => {
    const dependencies = provisioningDependenciesForObservedRuntime(
      {
        ...observedKatanaRuntimeArtifact(),
        observedAt: "2026-07-18T12:31:00.000Z",
      },
      ["2026-07-18T12:30:00.000Z", "2026-07-18T12:40:00.000Z"],
    );

    await expect(dependencies.provisionKatana(REQUESTED_STACK)).rejects.toThrow(
      "Observed Katana runtime exceeds the five-minute freshness window",
    );
  });

  test("rejects future observed EC2 evidence", async () => {
    const dependencies = provisioningDependenciesForObservedRuntime(
      {
        ...observedKatanaRuntimeArtifact(),
        observedAt: "2026-07-18T12:40:02.000Z",
      },
      ["2026-07-18T12:40:00.000Z", "2026-07-18T12:40:01.000Z"],
    );

    await expect(dependencies.provisionKatana(REQUESTED_STACK)).rejects.toThrow(
      "Observed Katana runtime was captured in the future",
    );
  });

  test("rejects registry publication when read-after-write verification differs", async () => {
    const unchangedRegistry = getEmbeddedReadOnlyRuntimeRegistry();
    const dependencies = createAwsGameStackProvisioningDependencies(provisioningConfig(), {
      now: () => new Date("2026-07-18T12:40:00.000Z"),
      fetchImpl: async (_input, init) =>
        init?.method === "POST"
          ? Response.json(JSON.parse(String(init.body)).registry)
          : Response.json(unchangedRegistry),
    });

    try {
      await dependencies.publishReadyGameStack(readyGameStackForPublication());
      throw new Error("expected registry publication to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(GameStackPublicationAttemptError);
      expect(error).toMatchObject({
        publicationRevision: 2,
        message: "Runtime registry read-back did not match published revision 2",
      });
    }
  });

  test("retains an ambiguous publication until its attempted revision is observable", async () => {
    const dependencies = createAwsGameStackProvisioningDependencies(provisioningConfig(), {
      now: () => new Date("2026-07-18T12:40:00.000Z"),
      fetchImpl: async () => Response.json(getEmbeddedReadOnlyRuntimeRegistry()),
    });
    const gameStack = { ...readyGameStackForPublication(), publicationRevision: 2 };

    await expect(dependencies.removeReadyGameStackPublication(gameStack)).rejects.toThrow(
      "Runtime registry has not observed attempted publication revision 2",
    );
  });

  test("verifies exact publication removal before cleanup succeeds", async () => {
    let registry = getEmbeddedReadOnlyRuntimeRegistry();
    const dependencies = createAwsGameStackProvisioningDependencies(provisioningConfig(), {
      now: () => new Date("2026-07-18T12:40:00.000Z"),
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") registry = JSON.parse(String(init.body)).registry;
        return Response.json(registry);
      },
    });
    const gameStack = readyGameStackForPublication();
    const publication = await dependencies.publishReadyGameStack(gameStack);

    await dependencies.removeReadyGameStackPublication({ ...gameStack, ...publication });

    expect(registry.revision).toBe(3);
    expect(registry.activeGameStacks?.["mainnet.blitz"]).toBeUndefined();
    expect(
      Object.values(registry.aliases).some(
        (alias) =>
          alias.runtimeName === gameStack.gameStackId && alias.publicationRevision === publication.publicationRevision,
      ),
    ).toBeFalse();
  });

  test("removes exact old aliases while preserving a newer active pointer", async () => {
    let registry = getEmbeddedReadOnlyRuntimeRegistry();
    const dependencies = createAwsGameStackProvisioningDependencies(provisioningConfig(), {
      now: () => new Date("2026-07-18T12:40:00.000Z"),
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") registry = JSON.parse(String(init.body)).registry;
        return Response.json(registry);
      },
    });
    const gameStack = readyGameStackForPublication();
    const publication = await dependencies.publishReadyGameStack(gameStack);
    const activePointer = registry.activeGameStacks?.["mainnet.blitz"];
    if (!activePointer) throw new Error("expected published active pointer");
    registry = {
      ...registry,
      revision: 3,
      generatedAt: "2026-07-18T12:41:00.000Z",
      activeGameStacks: {
        ...registry.activeGameStacks,
        "mainnet.blitz": {
          ...activePointer,
          gameStackId: "blitz-season-43",
          publicationRevision: 3,
          activeUntil: "2026-07-18T14:00:00.000Z",
        },
      },
    };

    await dependencies.removeReadyGameStackPublication({ ...gameStack, ...publication });

    expect(registry.revision).toBe(4);
    expect(registry.activeGameStacks?.["mainnet.blitz"]).toMatchObject({
      gameStackId: "blitz-season-43",
      publicationRevision: 3,
    });
    expect(
      Object.values(registry.aliases).some(
        (alias) =>
          alias.runtimeName === gameStack.gameStackId && alias.publicationRevision === publication.publicationRevision,
      ),
    ).toBeFalse();
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

function provisioningConfig() {
  return {
    tableName: "runtime-control",
    region: "us-east-2",
    operationsUrl: "https://operations.example",
    registryUrl: "https://registry.example/api/runtime-registry/v1",
    registryAdminSecret: "registry-secret",
    serviceToken: "service-secret",
  };
}

function provisioningDependenciesForObservedRuntime(
  observedRuntime: ObservedKatanaRuntimeArtifactV1,
  times: readonly string[] = ["2026-07-18T12:40:00.000Z", "2026-07-18T12:40:01.000Z"],
) {
  let timeIndex = 0;
  return createAwsGameStackProvisioningDependencies(provisioningConfig(), {
    now: () => new Date(times[Math.min(timeIndex++, times.length - 1)]!),
    fetchImpl: async () => Response.json({ observedRuntime }),
  });
}

interface KatanaProvisioningPayload {
  schemaVersion: 1;
  gameStack: GameStack;
  desiredRuntime: AwsRuntimeRequest;
}

type OperationPayload = GameStack | KatanaProvisioningPayload;

function operationResponse(operation: string, payload: OperationPayload): Response {
  if (operation === "provision-katana") {
    if (!isKatanaProvisioningPayload(payload))
      return Response.json({ error: "missing desired runtime" }, { status: 400 });
    return Response.json({
      observedRuntime: observedKatanaRuntimeArtifact(),
    });
  }
  const gameStack = payload as GameStack;
  if (operation === "verify-katana-attestation") {
    return Response.json({
      schemaVersion: 1,
      attestationMeasurement: PINNED_ATTESTATION_MEASUREMENT,
      attestationDocumentSha256: `sha256:${"e".repeat(64)}`,
      reportDataHash: buildGameStackAttestationReportDataHash(gameStack),
      verifiedAt: gameStack.readiness!.identitySealedAt,
    });
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

function isKatanaProvisioningPayload(payload: OperationPayload): payload is KatanaProvisioningPayload {
  return "desiredRuntime" in payload;
}

function observedKatanaRuntimeArtifact(): ObservedKatanaRuntimeArtifactV1 {
  return {
    schemaVersion: 1,
    provider: "aws",
    observationSource: "ec2-describe-instances",
    operationId: "blitz-season-42:provision-katana",
    observedAt: "2026-07-18T12:40:00.002Z",
    region: "us-east-2",
    ec2InstanceId: "i-0123456789abcdef0",
    runtimePlatform: "ec2-sev-snp",
    amdSevSnp: "enabled",
    tenancy: "default",
    environmentId: "mainnet.blitz",
    runtimeKind: "katana",
    runtimeName: "blitz-season-42",
    runtimeInstanceId: KATANA_RUNTIME_INSTANCE_ID,
    version: REQUESTED_STACK.katanaTeeRelease.releaseTag,
    vmAssetDigest: REQUESTED_STACK.katanaTeeRelease.vmAssetDigest,
    releaseIdentitySha256: REQUESTED_STACK.katanaTeeRelease.releaseIdentitySha256,
    attestationMeasurement: PINNED_ATTESTATION_MEASUREMENT,
    ownerTags: {
      Project: "eternum",
      Environment: "mainnet.blitz",
      RuntimeKind: "katana",
      RuntimeName: "blitz-season-42",
      RuntimeInstanceId: KATANA_RUNTIME_INSTANCE_ID,
      RuntimeProvider: "aws",
      RuntimeVersion: REQUESTED_STACK.katanaTeeRelease.releaseTag,
      ExposurePolicy: "public-read",
      LifecycleClass: "ephemeral",
      GameName: "blitz-season-42",
      RunKind: "game",
      RunName: "blitz-season-42",
      AutoTeardown: "true",
      DeleteAfter: REQUESTED_STACK.intendedEnd,
    },
    runtime: {
      runtimeName: "blitz-season-42",
      runtimeInstanceId: KATANA_RUNTIME_INSTANCE_ID,
      imageDigest: REQUESTED_STACK.katanaTeeRelease.vmAssetDigest,
      routingShard: 0,
      chainId: "0x534e5f424c49545a",
      genesisHash: `0x6${"c".repeat(62)}`,
      endpoints: {
        base: "https://runtime.example/katana",
        health: "https://runtime.example/katana/health",
        rpc: "https://runtime.example/katana/rpc/v0_9",
      },
    },
  };
}

function readyGameStackForPublication(): GameStack {
  const runtime = observedKatanaRuntimeArtifact().runtime;
  return {
    ...REQUESTED_STACK,
    attestationMeasurement: PINNED_ATTESTATION_MEASUREMENT,
    katana: runtime,
    torii: {
      runtimeName: "blitz-season-42",
      runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
      imageDigest: `sha256:${"b".repeat(64)}`,
      routingShard: 0,
      endpoints: {
        base: "https://runtime.example/torii",
        health: "https://runtime.example/torii/health",
        sql: "https://runtime.example/torii/sql",
      },
    },
    readiness: {
      identitySealedAt: "2026-07-18T12:20:00.000Z",
      attestationVerifiedAt: "2026-07-18T12:25:00.000Z",
      worldReadyAt: "2026-07-18T12:30:00.000Z",
      indexerReadyAt: "2026-07-18T12:35:00.000Z",
      registryAvailableAt: "2026-07-18T12:39:00.000Z",
    },
    protocolLifecycle: "Attested",
    operationalPhase: "ready",
  };
}
