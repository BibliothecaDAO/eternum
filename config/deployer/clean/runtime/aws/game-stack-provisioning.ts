import { isDeepStrictEqual } from "node:util";
import { parseRuntimeRegistry, type RuntimeRegistryV1 } from "../../../../../common/factory/runtime-registry";
import {
  registerReadyGameStack,
  removeActiveGameStackPublication,
  type ReadyGameStackRegistration,
} from "../../../../../common/factory/runtime-registry-artifact";
import {
  createGameStackProvisioningHandler,
  GameStackPublicationAttemptError,
  type A23ReleaseAuthorizationVerification,
  type GameStack,
  type GameStackAttestationEvidence,
  type GameStackProvisioningDependencies,
  type GameStackRuntimeIdentity,
} from "../../game-stack";
import { runAwsCommand, type AwsCommandRunner } from "./commands";
import { validateAwsRuntimeDesiredState } from "./reconcile";
import type { AwsRuntimeRequest } from "../aws-runtime";
import { deriveDeterministicRuntimeInstanceId } from "../runtime-identity";
import { assertObservedKatanaMatchesDesiredState, parseObservedKatanaRuntimeArtifact } from "./katana-runtime-artifact";
import {
  persistBlitzGameStackProvisioningFailure,
  persistBlitzGameStackTransition,
  releaseBlitzGameStackAdmission,
} from "./game-stack-control";
import { assertCurrentWave0ReleaseDecision } from "./wave0-release";

const BLITZ_ENVIRONMENT_ID = "mainnet.blitz";
type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface AwsGameStackProvisioningConfig {
  tableName: string;
  region: string;
  operationsUrl: string;
  registryUrl: string;
  registryAdminSecret: string;
  serviceToken: string;
  releaseAuthorization?: A23ReleaseAuthorizationVerification;
}

export interface AwsGameStackProvisioningAdapters {
  commandRunner?: AwsCommandRunner;
  fetchImpl?: FetchImplementation;
  now?: () => Date;
  assertProductionReleaseAuthorized?: () => void;
}

export function createAwsGameStackProvisioningServiceHandler(
  config: AwsGameStackProvisioningConfig,
  adapters: AwsGameStackProvisioningAdapters = {},
): (request: Request) => Promise<Response> {
  validateProvisioningConfig(config);
  return createGameStackProvisioningHandler({
    serviceToken: config.serviceToken,
    provisioning: createAwsGameStackProvisioningDependencies(config, adapters),
  });
}

export function createAwsGameStackProvisioningDependencies(
  config: AwsGameStackProvisioningConfig,
  adapters: AwsGameStackProvisioningAdapters = {},
): GameStackProvisioningDependencies {
  validateProvisioningConfig(config);
  const commandRunner = adapters.commandRunner ?? runAwsCommand;
  const fetchImpl = adapters.fetchImpl ?? fetch;
  const now = adapters.now ?? (() => new Date());
  const operations = createGameStackOperationsClient(config, fetchImpl, now);
  const registry = createGameStackRegistryClient(config, fetchImpl, now);
  return {
    now,
    acceptSeasonIntent: (gameStack) => operations.run("accept-season-intent", gameStack),
    provisionKatana: (gameStack) => operations.readKatanaRuntime(gameStack),
    sealKatanaIdentity: (gameStack) => operations.run("seal-katana-identity", gameStack),
    verifyKatanaAttestation: (gameStack) => operations.readAttestationEvidence(gameStack),
    deployWorld: (gameStack) => operations.readWorldAddress(gameStack),
    provisionTorii: (gameStack) => operations.readRuntime("provision-torii", gameStack),
    verifyIndexerReadiness: (gameStack) => operations.run("verify-indexer-readiness", gameStack),
    verifyRegistryAvailability: () => registry.verifyAvailability(),
    assertProductionReleaseAuthorized: async () =>
      (
        adapters.assertProductionReleaseAuthorized ??
        (() => assertCurrentWave0ReleaseDecision(config.releaseAuthorization))
      )(),
    publishReadyGameStack: (gameStack) => registry.publishReadyStack(gameStack),
    removeReadyGameStackPublication: (gameStack) => registry.removeReadyStack(gameStack),
    persistTransition: async (expected, next) =>
      persistBlitzGameStackTransition(commandRunner, controlRequest(config, { expected, next })),
    persistProvisioningFailure: async (gameStack) => {
      persistBlitzGameStackProvisioningFailure(commandRunner, controlRequest(config, { gameStack }));
    },
    abortProvisionedInfrastructure: (gameStack) => operations.run("abort-provisioning", gameStack),
    releaseAdmission: async (gameStackId) =>
      releaseBlitzGameStackAdmission(commandRunner, controlRequest(config, { gameStackId })),
  };
}

function createGameStackOperationsClient(
  config: AwsGameStackProvisioningConfig,
  fetchImpl: FetchImplementation,
  now: () => Date,
) {
  async function invoke(
    operation: string,
    gameStack: GameStack,
    payload: unknown = gameStack,
  ): Promise<Record<string, unknown>> {
    const url = new URL(
      `/v1/blitz/game-stacks/${encodeURIComponent(gameStack.gameStackId)}/operations/${operation}`,
      config.operationsUrl,
    );
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": gameStackOperationId(gameStack, operation),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Game-stack operation "${operation}" failed with HTTP ${response.status}`);
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error(`Game-stack operation "${operation}" returned an invalid response`);
    }
    return body as Record<string, unknown>;
  }

  return {
    async run(operation: string, gameStack: GameStack): Promise<void> {
      await invoke(operation, gameStack);
    },
    async readRuntime(operation: string, gameStack: GameStack): Promise<GameStackRuntimeIdentity> {
      return (await invoke(operation, gameStack)) as unknown as GameStackRuntimeIdentity;
    },
    async readKatanaRuntime(gameStack: GameStack): Promise<GameStackRuntimeIdentity> {
      const operation = "provision-katana";
      const desiredRuntime = buildDesiredKatanaRuntimeRequest(gameStack);
      validateAwsRuntimeDesiredState(desiredRuntime);
      const requestStartedAt = now();
      const response = await invoke(operation, gameStack, {
        schemaVersion: 1,
        gameStack,
        desiredRuntime,
      });
      const observedRuntime = parseObservedKatanaRuntimeArtifact(response.observedRuntime);
      assertObservedKatanaMatchesDesiredState(desiredRuntime, observedRuntime, {
        expectedRegion: config.region,
        expectedOperationId: gameStackOperationId(gameStack, operation),
        requestStartedAt,
        validatedAt: now(),
      });
      return observedRuntime.runtime;
    },
    async readAttestationEvidence(gameStack: GameStack): Promise<GameStackAttestationEvidence> {
      const response = await invoke("verify-katana-attestation", gameStack);
      return {
        schemaVersion: requireSchemaVersionOne(response),
        attestationMeasurement: requireString(response, "attestationMeasurement"),
        attestationDocumentSha256: requireString(response, "attestationDocumentSha256"),
        reportDataHash: requireString(response, "reportDataHash"),
        verifiedAt: requireString(response, "verifiedAt"),
      };
    },
    async readWorldAddress(gameStack: GameStack): Promise<string> {
      return requireString(await invoke("deploy-world", gameStack), "worldAddress");
    },
  };
}

function gameStackOperationId(gameStack: GameStack, operation: string): string {
  return `${gameStack.gameStackId}:${operation}`;
}

function buildDesiredKatanaRuntimeRequest(gameStack: GameStack): AwsRuntimeRequest {
  const runtimeInstanceId = deriveDeterministicRuntimeInstanceId([
    "game-stack-katana",
    gameStack.gameStackId,
    gameStack.deploymentId,
  ]);
  return {
    environmentId: BLITZ_ENVIRONMENT_ID,
    runtimeKind: "katana",
    runtimeName: gameStack.gameStackId,
    runtimeInstanceId,
    version: gameStack.katanaTeeRelease.releaseTag,
    imageDigest: gameStack.katanaTeeRelease.vmAssetDigest,
    exposurePolicy: "public-read",
    lifecycleClass: "ephemeral",
    expectedDeleteAfter: gameStack.intendedEnd,
    runtimePlatform: "ec2-sev-snp",
    attestationMeasurement: `sha384:${gameStack.katanaTeeRelease.launchMeasurement}`,
    katanaTeeRelease: gameStack.katanaTeeRelease,
    owner: {
      runtimeInstanceId,
      gameName: gameStack.gameStackId,
      runKind: "game",
      runName: gameStack.gameStackId,
      autoTeardown: true,
      deleteAfter: gameStack.intendedEnd,
      lifecycleClass: "ephemeral",
    },
  };
}

function createGameStackRegistryClient(
  config: AwsGameStackProvisioningConfig,
  fetchImpl: FetchImplementation,
  now: () => Date,
) {
  async function read(): Promise<RuntimeRegistryV1> {
    const response = await fetchImpl(config.registryUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Required runtime registry is unavailable with HTTP ${response.status}`);
    return parseRuntimeRegistry(await response.json());
  }

  async function publish(current: RuntimeRegistryV1, next: RuntimeRegistryV1): Promise<void> {
    const response = await fetchImpl(config.registryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-factory-admin-secret": config.registryAdminSecret,
      },
      body: JSON.stringify({ registry: next, expectedRevision: current.revision }),
    });
    if (!response.ok) throw new Error(`Runtime registry publication failed with HTTP ${response.status}`);
  }

  return {
    async verifyAvailability(): Promise<void> {
      await read();
    },
    async publishReadyStack(
      gameStack: GameStack,
    ): Promise<{ publicationRevision: number; publicationVerifiedAt: string }> {
      const current = await read();
      const next = registerReadyGameStack(current, buildReadyStackRegistration(gameStack), now());
      try {
        await publish(current, next);
        const published = await read();
        if (!isDeepStrictEqual(published, next)) {
          throw new Error(`Runtime registry read-back did not match published revision ${next.revision}`);
        }
      } catch (error) {
        throw new GameStackPublicationAttemptError(next.revision, error);
      }
      return {
        publicationRevision: next.revision,
        publicationVerifiedAt: now().toISOString(),
      };
    },
    async removeReadyStack(gameStack: GameStack): Promise<void> {
      if (gameStack.publicationRevision === undefined) return;
      const current = await read();
      if (current.revision < gameStack.publicationRevision) {
        throw new Error(
          `Runtime registry has not observed attempted publication revision ${gameStack.publicationRevision}`,
        );
      }
      const next = removeActiveGameStackPublication(
        current,
        {
          gameStackId: gameStack.gameStackId,
          activeUntil: gameStack.intendedEnd,
          publicationRevision: gameStack.publicationRevision,
        },
        now(),
      );
      if (next.revision === current.revision) {
        assertPublicationAbsent(current, gameStack);
        return;
      }
      await publish(current, next);
      const verified = await read();
      if (verified.revision < next.revision) {
        throw new Error(`Runtime registry has not observed cleanup revision ${next.revision}`);
      }
      assertPublicationAbsent(verified, gameStack);
    },
  };
}

function assertPublicationAbsent(registry: RuntimeRegistryV1, gameStack: GameStack): void {
  const publicationRevision = gameStack.publicationRevision;
  const activePointer = registry.activeGameStacks?.[BLITZ_ENVIRONMENT_ID];
  const hasExactPointer =
    activePointer?.gameStackId === gameStack.gameStackId &&
    activePointer.publicationRevision === publicationRevision &&
    activePointer.activeUntil === gameStack.intendedEnd;
  const hasExactAlias = Object.values(registry.aliases).some(
    (alias) =>
      alias.runtimeName === gameStack.gameStackId &&
      alias.publicationRevision === publicationRevision &&
      alias.activeUntil === gameStack.intendedEnd,
  );
  if (hasExactPointer || hasExactAlias) {
    throw new Error(`Runtime registry still contains publication revision ${publicationRevision}`);
  }
}

function buildReadyStackRegistration(gameStack: GameStack): ReadyGameStackRegistration {
  const readiness = gameStack.readiness;
  const katana = gameStack.katana;
  const torii = gameStack.torii;
  if (!readiness || !katana || !torii || !gameStack.attestationMeasurement) {
    throw new Error("Game-stack registry publication requires complete readiness and runtime identity");
  }
  return {
    environmentId: BLITZ_ENVIRONMENT_ID,
    gameStackId: gameStack.gameStackId,
    activeUntil: gameStack.intendedEnd,
    releaseIdentitySha256: gameStack.katanaTeeRelease.releaseIdentitySha256,
    attestationMeasurement: gameStack.attestationMeasurement,
    verification: {
      identitySealedAt: requireString(readiness, "identitySealedAt"),
      attestationVerifiedAt: requireString(readiness, "attestationVerifiedAt"),
      worldReadyAt: requireString(readiness, "worldReadyAt"),
      indexerReadyAt: requireString(readiness, "indexerReadyAt"),
      registryAvailableAt: requireString(readiness, "registryAvailableAt"),
    },
    katana: buildRegistryRuntime(katana, ["base", "health", "rpc"] as const),
    torii: buildRegistryRuntime(torii, ["base", "health", "sql"] as const),
  };
}

function buildRegistryRuntime<K extends "base" | "health" | "rpc" | "sql">(
  runtime: GameStackRuntimeIdentity,
  endpointKinds: readonly K[],
) {
  if (!Number.isInteger(runtime.routingShard) || runtime.routingShard! < 0) {
    throw new Error("Game-stack registry publication requires a routing shard");
  }
  return {
    runtimeInstanceId: runtime.runtimeInstanceId,
    imageDigest: runtime.imageDigest,
    routingShard: runtime.routingShard!,
    endpoints: Object.fromEntries(
      endpointKinds.map((kind) => [kind, requireString(runtime.endpoints ?? {}, kind)]),
    ) as Record<K, string>,
  };
}

function requireString(value: object, key: string): string {
  const field = (value as Record<string, unknown>)[key];
  if (typeof field !== "string" || !field.trim()) throw new Error(`Game-stack response requires ${key}`);
  return field;
}

function requireSchemaVersionOne(value: object): 1 {
  if ((value as Record<string, unknown>).schemaVersion !== 1) {
    throw new Error("Game-stack response requires schemaVersion=1");
  }
  return 1;
}

function controlRequest<T extends object>(config: AwsGameStackProvisioningConfig, request: T) {
  return {
    tableName: config.tableName,
    region: config.region,
    environmentId: BLITZ_ENVIRONMENT_ID,
    ...request,
  };
}

function validateProvisioningConfig(config: AwsGameStackProvisioningConfig): void {
  for (const [name, value] of Object.entries({
    tableName: config.tableName,
    region: config.region,
    operationsUrl: config.operationsUrl,
    registryUrl: config.registryUrl,
    registryAdminSecret: config.registryAdminSecret,
    serviceToken: config.serviceToken,
  })) {
    if (!value.trim()) throw new Error(`AWS game-stack provisioning requires ${name}`);
  }
  for (const [name, value] of [
    ["operationsUrl", config.operationsUrl],
    ["registryUrl", config.registryUrl],
  ]) {
    if (new URL(value).protocol !== "https:") throw new Error(`AWS game-stack provisioning requires HTTPS ${name}`);
  }
}
