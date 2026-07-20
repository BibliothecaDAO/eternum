import { describe, expect, test } from "bun:test";
import { provisionGameStack, type GameStackProvisioningDependencies } from "../game-stack/orchestrator";
import type { GameStack } from "../game-stack/types";

const KATANA = {
  chainId: "0x534e5f424c49545a",
  runtimeName: "blitz-season-42-katana",
  runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
  imageDigest: `sha256:${"a".repeat(64)}`,
  routingShard: 0,
  endpoints: {
    base: "https://runtime.example/katana",
    health: "https://runtime.example/katana/health",
    rpc: "https://runtime.example/katana/rpc/v0_9",
  },
};

const TORII = {
  runtimeName: "blitz-season-42-torii",
  runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
  imageDigest: `sha256:${"b".repeat(64)}`,
  routingShard: 0,
  endpoints: {
    base: "https://runtime.example/torii",
    health: "https://runtime.example/torii/health",
    sql: "https://runtime.example/torii/sql",
  },
};

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

function createDependencies(events: string[], now = new Date("2026-07-18T12:40:00.000Z")) {
  let tick = now.getTime();
  const dependencies: GameStackProvisioningDependencies = {
    now: () => new Date(tick++),
    acceptSeasonIntent: async () => events.push("accept-intent"),
    provisionKatana: async () => {
      events.push("provision-katana");
      return KATANA;
    },
    sealKatanaIdentity: async () => events.push("seal-identity"),
    verifyKatanaAttestation: async () => {
      events.push("verify-attestation");
      return `sha384:${"c".repeat(96)}`;
    },
    deployWorld: async () => {
      events.push("deploy-world");
      return "0x9876";
    },
    provisionTorii: async () => {
      events.push("provision-torii");
      return TORII;
    },
    verifyIndexerReadiness: async () => events.push("verify-indexer"),
    verifyRegistryAvailability: async () => events.push("verify-registry"),
    assertProductionReleaseAuthorized: async () => events.push("authorize-production"),
    publishReadyGameStack: async () => {
      events.push("publish-stack");
      return 42;
    },
    removeReadyGameStackPublication: async () => events.push("remove-publication"),
    persistTransition: async (_expected, stack) => {
      events.push(`persist:${stack.operationalPhase}`);
    },
    abortProvisioning: async () => events.push("abort-provisioning"),
    releaseAdmission: async () => events.push("release-admission"),
  };
  return dependencies;
}

describe("Blitz game-stack provisioning orchestrator", () => {
  test("publishes Katana and Torii together only after the ordered readiness ladder", async () => {
    const events: string[] = [];
    const transitions: Array<{ expected: GameStack; next: GameStack }> = [];
    const dependencies = createDependencies(events);
    dependencies.persistTransition = async (expected, next) => {
      transitions.push({ expected, next });
      events.push(`persist:${next.operationalPhase}`);
    };
    const provisioned = await provisionGameStack(requestedStack(), dependencies);

    expect(events).toEqual([
      "accept-intent",
      "persist:provisioning-l3",
      "provision-katana",
      "seal-identity",
      "persist:provisioning-l3",
      "verify-attestation",
      "persist:deploying-world",
      "deploy-world",
      "persist:provisioning-indexer",
      "provision-torii",
      "verify-indexer",
      "persist:provisioning-indexer",
      "verify-registry",
      "authorize-production",
      "publish-stack",
      "persist:ready",
    ]);
    expect(provisioned).toMatchObject({
      protocolLifecycle: "Attested",
      operationalPhase: "ready",
      l3ChainId: "0x534e5f424c49545a",
      worldAddress: "0x9876",
      attestationMeasurement: `sha384:${"c".repeat(96)}`,
      publicationRevision: 42,
      katana: KATANA,
      torii: TORII,
    });
    expect(provisioned.readiness).toEqual({
      identitySealedAt: "2026-07-18T12:40:00.002Z",
      attestationVerifiedAt: "2026-07-18T12:40:00.004Z",
      worldReadyAt: "2026-07-18T12:40:00.006Z",
      indexerReadyAt: "2026-07-18T12:40:00.008Z",
      registryVerifiedAt: "2026-07-18T12:40:00.010Z",
    });
    expect(transitions.at(-1)?.expected.operationalPhase).toBe("provisioning-indexer");
    expect(transitions.at(-1)?.expected.publicationRevision).toBeUndefined();
    expect(transitions.at(-1)?.expected.readiness?.registryVerifiedAt).toBeUndefined();
    expect(transitions.at(-1)?.next).toMatchObject({
      operationalPhase: "ready",
      publicationRevision: 42,
      readiness: { registryVerifiedAt: "2026-07-18T12:40:00.010Z" },
    });
  });

  test("uses the protocol abort path and releases only its admission after the readiness deadline", async () => {
    const events: string[] = [];
    const dependencies = createDependencies(events, new Date("2026-07-18T12:46:00.000Z"));

    await expect(provisionGameStack(requestedStack(), dependencies)).rejects.toThrow(
      "missed its fixed readiness deadline",
    );
    expect(events).toEqual(["abort-provisioning", "release-admission"]);
  });

  test("records a structured failure and conditionally releases its admission when provisioning fails", async () => {
    const events: string[] = [];
    let failedStack: GameStack | undefined;
    const dependencies = createDependencies(events);
    dependencies.deployWorld = async () => {
      events.push("deploy-world");
      throw new Error("World deployment rejected");
    };
    dependencies.abortProvisioning = async (gameStack) => {
      failedStack = gameStack;
      events.push("abort-provisioning");
    };

    await expect(provisionGameStack(requestedStack(), dependencies)).rejects.toThrow("World deployment rejected");

    expect(events.slice(-2)).toEqual(["abort-provisioning", "release-admission"]);
    expect(failedStack).toMatchObject({
      gameStackId: "blitz-season-42",
      protocolLifecycle: "ProvisioningAborted",
      operationalPhase: "failed",
      failure: {
        classification: "provisioning-failure",
        message: "World deployment rejected",
        retryable: true,
      },
    });
  });

  test("fails closed before sealing when Katana has no immutable L3 identity", async () => {
    const events: string[] = [];
    const dependencies = createDependencies(events);
    dependencies.provisionKatana = async () => {
      events.push("provision-katana");
      return { ...KATANA, chainId: undefined };
    };

    await expect(provisionGameStack(requestedStack(), dependencies)).rejects.toThrow(
      "Katana chain ID is required before game-stack readiness",
    );

    expect(events).not.toContain("seal-identity");
    expect(events.slice(-2)).toEqual(["abort-provisioning", "release-admission"]);
  });

  test("carries the newest runtime identity into cleanup when persistence fails", async () => {
    const events: string[] = [];
    let aborted: GameStack | undefined;
    const dependencies = createDependencies(events);
    dependencies.persistTransition = async (_expected, stack) => {
      events.push(`persist:${stack.operationalPhase}`);
      if (stack.katana) throw new Error("transition store unavailable");
    };
    dependencies.abortProvisioning = async (gameStack) => {
      aborted = gameStack;
      events.push("abort-provisioning");
    };

    await expect(provisionGameStack(requestedStack(), dependencies)).rejects.toThrow("transition store unavailable");

    expect(aborted?.katana).toEqual(KATANA);
    expect(events.slice(-2)).toEqual(["abort-provisioning", "release-admission"]);
  });

  test("removes an exact publication and releases admission when final persistence fails", async () => {
    const events: string[] = [];
    let removedPublication: GameStack | undefined;
    const dependencies = createDependencies(events);
    dependencies.persistTransition = async (_expected, stack) => {
      events.push(`persist:${stack.operationalPhase}`);
      if (stack.operationalPhase === "ready") throw new Error("ready transition unavailable");
    };
    dependencies.removeReadyGameStackPublication = async (gameStack) => {
      removedPublication = gameStack;
      events.push("remove-publication");
    };
    dependencies.abortProvisioning = async () => {
      events.push("abort-provisioning");
      throw new Error("infrastructure cleanup deferred");
    };

    await expect(provisionGameStack(requestedStack(), dependencies)).rejects.toThrow("ready transition unavailable");

    expect(removedPublication).toMatchObject({
      gameStackId: "blitz-season-42",
      publicationRevision: 42,
      protocolLifecycle: "ProvisioningAborted",
    });
    expect(events.slice(-3)).toEqual(["remove-publication", "abort-provisioning", "release-admission"]);
  });

  test("rechecks production authorization before publication", async () => {
    const events: string[] = [];
    const dependencies = createDependencies(events);
    dependencies.assertProductionReleaseAuthorized = async () => {
      events.push("authorize-production");
      throw new Error("A23 authorization revoked");
    };

    await expect(provisionGameStack(requestedStack(), dependencies)).rejects.toThrow("A23 authorization revoked");

    expect(events).not.toContain("publish-stack");
    expect(events.slice(-2)).toEqual(["abort-provisioning", "release-admission"]);
  });
});
