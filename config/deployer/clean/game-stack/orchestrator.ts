import {
  deriveGameStackOperationalPhase,
  type FailedGameStack,
  type GameStack,
  type GameStackReadinessEvidence,
  type GameStackRuntimeIdentity,
} from "./types";

export interface GameStackProvisioningDependencies {
  now(): Date;
  acceptSeasonIntent(gameStack: GameStack): Promise<void>;
  provisionKatana(gameStack: GameStack): Promise<GameStackRuntimeIdentity>;
  sealKatanaIdentity(gameStack: GameStack): Promise<void>;
  verifyKatanaAttestation(gameStack: GameStack): Promise<string>;
  deployWorld(gameStack: GameStack): Promise<string>;
  provisionTorii(gameStack: GameStack): Promise<GameStackRuntimeIdentity>;
  verifyIndexerReadiness(gameStack: GameStack): Promise<void>;
  verifyRegistryAvailability(gameStack: GameStack): Promise<void>;
  assertProductionReleaseAuthorized(): Promise<void>;
  publishReadyGameStack(gameStack: GameStack): Promise<number>;
  removeReadyGameStackPublication(gameStack: GameStack): Promise<void>;
  persistTransition(expected: GameStack, next: GameStack): Promise<void>;
  abortProvisioning(gameStack: FailedGameStack): Promise<void>;
  releaseAdmission(gameStackId: string): Promise<void>;
}

export async function provisionGameStack(
  requestedStack: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  let gameStack = requestedStack;
  try {
    assertProvisioningCanStart(gameStack, dependencies.now());
    gameStack = await acceptSeasonIntent(gameStack, dependencies);
    gameStack = await provisionAttestedKatana(gameStack, dependencies);
    gameStack = await deployInitialWorld(gameStack, dependencies);
    gameStack = await provisionReadyIndexer(gameStack, dependencies);
    const lastPersistedStack = gameStack;
    gameStack = await prepareReadyPublication(gameStack, dependencies);
    assertReadinessDeadline(gameStack, dependencies.now());
    await runProvisioningStep(gameStack, dependencies.assertProductionReleaseAuthorized);
    const publicationRevision = await runProvisioningStep(gameStack, () =>
      dependencies.publishReadyGameStack(gameStack),
    );
    gameStack = { ...gameStack, publicationRevision };
    gameStack = await persistPreparedProvisioningState(lastPersistedStack, gameStack, dependencies);
    return gameStack;
  } catch (error) {
    const failedStack = error instanceof GameStackProvisioningStepError ? error.gameStack : gameStack;
    const cause = error instanceof GameStackProvisioningStepError ? error.cause : error;
    return abortFailedProvisioning(failedStack, cause, dependencies);
  }
}

async function acceptSeasonIntent(
  gameStack: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  await dependencies.acceptSeasonIntent(gameStack);
  return persistProvisioningState(gameStack, "Provisioning", {}, dependencies);
}

async function provisionAttestedKatana(
  gameStack: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  const katana = await dependencies.provisionKatana(gameStack);
  assertKatanaIdentityComplete(katana);
  const katanaProvisioned = { ...gameStack, katana };
  await runProvisioningStep(katanaProvisioned, () => dependencies.sealKatanaIdentity(katanaProvisioned));
  const identitySealed = await persistProvisioningState(
    gameStack,
    "ProvisioningIdentitySealed",
    { katana, readiness: recordReadiness(gameStack.readiness, "identitySealedAt", dependencies.now()) },
    dependencies,
  );
  const attestationMeasurement = await dependencies.verifyKatanaAttestation(identitySealed);
  return persistProvisioningState(
    identitySealed,
    "Attested",
    {
      attestationMeasurement,
      l3ChainId: katana.chainId,
      readiness: recordReadiness(identitySealed.readiness, "attestationVerifiedAt", dependencies.now()),
    },
    dependencies,
  );
}

async function deployInitialWorld(
  gameStack: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  const worldAddress = await dependencies.deployWorld(gameStack);
  assertNonEmptyIdentity(worldAddress, "World address");
  return persistProvisioningState(
    gameStack,
    "Attested",
    { worldAddress, readiness: recordReadiness(gameStack.readiness, "worldReadyAt", dependencies.now()) },
    dependencies,
  );
}

async function provisionReadyIndexer(
  gameStack: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  const torii = await dependencies.provisionTorii(gameStack);
  assertToriiIdentityComplete(torii);
  const indexerProvisioned = { ...gameStack, torii };
  await runProvisioningStep(indexerProvisioned, () => dependencies.verifyIndexerReadiness(indexerProvisioned));
  return persistProvisioningState(
    gameStack,
    "Attested",
    { torii, readiness: recordReadiness(gameStack.readiness, "indexerReadyAt", dependencies.now()) },
    dependencies,
  );
}

async function prepareReadyPublication(
  gameStack: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  await runProvisioningStep(gameStack, () => dependencies.verifyRegistryAvailability(gameStack));
  return buildProvisioningState(
    gameStack,
    "Attested",
    { readiness: recordReadiness(gameStack.readiness, "registryVerifiedAt", dependencies.now()) },
    dependencies,
  );
}

async function persistProvisioningState(
  current: GameStack,
  protocolLifecycle: GameStack["protocolLifecycle"],
  changes: Partial<GameStack>,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  const next = buildProvisioningState(current, protocolLifecycle, changes, dependencies);
  try {
    await dependencies.persistTransition(current, next);
  } catch (error) {
    throw new GameStackProvisioningStepError(next, error);
  }
  return next;
}

async function persistPreparedProvisioningState(
  expected: GameStack,
  prepared: GameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<GameStack> {
  const next = { ...prepared, updatedAt: dependencies.now().toISOString() };
  try {
    await dependencies.persistTransition(expected, next);
  } catch (error) {
    throw new GameStackProvisioningStepError(next, error);
  }
  return next;
}

function buildProvisioningState(
  current: GameStack,
  protocolLifecycle: GameStack["protocolLifecycle"],
  changes: Partial<GameStack>,
  dependencies: GameStackProvisioningDependencies,
): GameStack {
  const updatedAt = dependencies.now().toISOString();
  return {
    ...current,
    ...changes,
    protocolLifecycle,
    operationalPhase: deriveGameStackOperationalPhase(protocolLifecycle, changes.readiness ?? current.readiness),
    updatedAt,
  };
}

async function runProvisioningStep<T>(gameStack: GameStack, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new GameStackProvisioningStepError(gameStack, error);
  }
}

function recordReadiness(
  current: GameStackReadinessEvidence | undefined,
  step: keyof GameStackReadinessEvidence,
  recordedAt: Date,
): GameStackReadinessEvidence {
  return { ...current, [step]: recordedAt.toISOString() };
}

function assertKatanaIdentityComplete(katana: GameStackRuntimeIdentity): void {
  assertNonEmptyIdentity(katana.chainId, "Katana chain ID");
  assertNonEmptyIdentity(katana.endpoints?.rpc, "Katana RPC endpoint");
}

function assertToriiIdentityComplete(torii: GameStackRuntimeIdentity): void {
  assertNonEmptyIdentity(torii.endpoints?.base, "Torii base endpoint");
  assertNonEmptyIdentity(torii.endpoints?.sql, "Torii SQL endpoint");
}

function assertNonEmptyIdentity(value: string | undefined, label: string): asserts value is string {
  if (!value?.trim()) throw new Error(`${label} is required before game-stack readiness`);
}

function assertProvisioningCanStart(gameStack: GameStack, now: Date): void {
  if (gameStack.protocolLifecycle !== "Intent" || gameStack.operationalPhase !== "reserving") {
    throw new Error(`Game stack "${gameStack.gameStackId}" is not awaiting provisioning`);
  }
  assertReadinessDeadline(gameStack, now);
}

function assertReadinessDeadline(gameStack: GameStack, now: Date): void {
  if (Date.parse(gameStack.readinessDeadline) > now.getTime()) return;
  throw new GameStackReadinessDeadlineError(
    `Game stack "${gameStack.gameStackId}" missed its fixed readiness deadline ${gameStack.readinessDeadline}`,
  );
}

async function abortFailedProvisioning(
  gameStack: GameStack,
  error: unknown,
  dependencies: GameStackProvisioningDependencies,
): Promise<never> {
  const failedAt = dependencies.now().toISOString();
  const missedDeadline = error instanceof GameStackReadinessDeadlineError;
  const failedStack: FailedGameStack = {
    ...gameStack,
    protocolLifecycle: "ProvisioningAborted",
    operationalPhase: "failed",
    failure: {
      classification: missedDeadline ? "readiness-deadline" : "provisioning-failure",
      message: error instanceof Error ? error.message : String(error),
      failedAt,
      retryable: !missedDeadline,
      step: missedDeadline ? "readiness-deadline" : gameStack.operationalPhase,
    },
    updatedAt: failedAt,
  };
  const cleanupErrors = await runProvisioningCleanup(failedStack, dependencies);
  if (cleanupErrors.length > 0) {
    throw new AggregateError([error, ...cleanupErrors], error instanceof Error ? error.message : String(error));
  }
  throw error;
}

async function runProvisioningCleanup(
  failedStack: FailedGameStack,
  dependencies: GameStackProvisioningDependencies,
): Promise<unknown[]> {
  const cleanupErrors: unknown[] = [];
  if (failedStack.publicationRevision !== undefined) {
    await captureCleanupFailure(() => dependencies.removeReadyGameStackPublication(failedStack), cleanupErrors);
  }
  await captureCleanupFailure(() => dependencies.abortProvisioning(failedStack), cleanupErrors);
  await captureCleanupFailure(() => dependencies.releaseAdmission(failedStack.gameStackId), cleanupErrors);
  return cleanupErrors;
}

async function captureCleanupFailure(action: () => Promise<void>, errors: unknown[]): Promise<void> {
  try {
    await action();
  } catch (error) {
    errors.push(error);
  }
}

class GameStackReadinessDeadlineError extends Error {}

class GameStackProvisioningStepError extends Error {
  constructor(
    readonly gameStack: GameStack,
    readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
