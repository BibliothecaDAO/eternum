import { parseRuntimeRegistry, type RuntimeRegistryV1 } from "../../../../../common/factory/runtime-registry";
import {
  registerReadyGameStack,
  removeActiveGameStackPublication,
  type ReadyGameStackRegistration,
} from "../../../../../common/factory/runtime-registry-artifact";
import {
  createGameStackProvisioningHandler,
  type A23ReleaseAuthorizationVerification,
  type GameStack,
  type GameStackProvisioningDependencies,
  type GameStackRuntimeIdentity,
} from "../../game-stack";
import { runAwsCommand, type AwsCommandRunner } from "./commands";
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
  const operations = createGameStackOperationsClient(config, fetchImpl);
  const registry = createGameStackRegistryClient(config, fetchImpl, now);
  return {
    now,
    acceptSeasonIntent: (gameStack) => operations.run("accept-season-intent", gameStack),
    provisionKatana: (gameStack) => operations.readRuntime("provision-katana", gameStack),
    sealKatanaIdentity: (gameStack) => operations.run("seal-katana-identity", gameStack),
    verifyKatanaAttestation: (gameStack) => operations.readAttestation(gameStack),
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
    abortProvisioning: async (gameStack) => {
      persistBlitzGameStackProvisioningFailure(commandRunner, controlRequest(config, { gameStack }));
      await operations.run("abort-provisioning", gameStack);
    },
    releaseAdmission: async (gameStackId) =>
      releaseBlitzGameStackAdmission(commandRunner, controlRequest(config, { gameStackId })),
  };
}

function createGameStackOperationsClient(config: AwsGameStackProvisioningConfig, fetchImpl: FetchImplementation) {
  async function invoke(operation: string, gameStack: GameStack): Promise<Record<string, unknown>> {
    const url = new URL(
      `/v1/blitz/game-stacks/${encodeURIComponent(gameStack.gameStackId)}/operations/${operation}`,
      config.operationsUrl,
    );
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${gameStack.gameStackId}:${operation}`,
      },
      body: JSON.stringify(gameStack),
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
    async readAttestation(gameStack: GameStack): Promise<string> {
      return requireString(await invoke("verify-katana-attestation", gameStack), "attestationMeasurement");
    },
    async readWorldAddress(gameStack: GameStack): Promise<string> {
      return requireString(await invoke("deploy-world", gameStack), "worldAddress");
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
    async publishReadyStack(gameStack: GameStack): Promise<number> {
      const current = await read();
      const next = registerReadyGameStack(current, buildReadyStackRegistration(gameStack), now());
      await publish(current, next);
      return next.revision;
    },
    async removeReadyStack(gameStack: GameStack): Promise<void> {
      if (gameStack.publicationRevision === undefined) return;
      const current = await read();
      const next = removeActiveGameStackPublication(
        current,
        {
          gameStackId: gameStack.gameStackId,
          activeUntil: gameStack.intendedEnd,
          publicationRevision: gameStack.publicationRevision,
        },
        now(),
      );
      if (next.revision !== current.revision) await publish(current, next);
    },
  };
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
    attestationMeasurement: gameStack.attestationMeasurement,
    verification: {
      identitySealedAt: requireString(readiness, "identitySealedAt"),
      attestationVerifiedAt: requireString(readiness, "attestationVerifiedAt"),
      worldReadyAt: requireString(readiness, "worldReadyAt"),
      indexerReadyAt: requireString(readiness, "indexerReadyAt"),
      registryVerifiedAt: requireString(readiness, "registryVerifiedAt"),
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
