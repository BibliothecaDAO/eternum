import {
  buildFactoryRuntimeAlias,
  buildGameRuntimeAlias,
  buildGlobalRuntimeAlias,
  buildSharedChainRuntimeAlias,
  parseRuntimeRegistry,
  type ActiveGameStackPointer,
  type RuntimeAliasScope,
  type RuntimeEndpointAlias,
  type RuntimeRegistryProvider,
  type RuntimeReadinessEvidence,
  type RuntimeRegistryV1,
} from "./runtime-registry";

type RuntimeEndpointKind = "base" | "health" | "rpc" | "sql";

export interface RegistryRuntimeArtifact {
  schemaVersion: 2;
  environmentId: string;
  runtimeKind: "katana" | "torii";
  runtimeName: string;
  runtimeInstanceId: string;
  imageDigest: string;
  routingShard: number;
  endpoints: Partial<Record<RuntimeEndpointKind, string>>;
}

export interface RegisterRuntimeArtifactOptions {
  scope: RuntimeAliasScope;
  provider: RuntimeRegistryProvider;
  activate?: boolean;
  fallbackEndpoints?: Partial<Record<RuntimeEndpointKind, string>>;
}

export interface RuntimeEndpointRegistration extends RegisterRuntimeArtifactOptions {
  environmentId: string;
  runtimeKind: "katana" | "torii";
  runtimeName: string;
  endpoints: Partial<Record<RuntimeEndpointKind, string>>;
  runtimeInstanceId?: string;
  imageDigest?: string;
  routingShard?: number;
  publicationClass?: "runtime" | "ready-game-stack";
  activeUntil?: string;
  publicationRevision?: number;
  attestationMeasurement?: string;
}

interface ReadyGameStackRuntimeIdentity {
  runtimeInstanceId: string;
  imageDigest: string;
  routingShard: number;
}

export interface ReadyGameStackKatanaArtifact extends ReadyGameStackRuntimeIdentity {
  endpoints: { base: string; health: string; rpc: string };
}

export interface ReadyGameStackToriiArtifact extends ReadyGameStackRuntimeIdentity {
  endpoints: { base: string; health: string; sql: string };
}

export type ReadyGameStackVerification = RuntimeReadinessEvidence;

export interface ReadyGameStackRegistration {
  environmentId: "mainnet.blitz";
  gameStackId: string;
  activeUntil: string;
  attestationMeasurement: string;
  verification: ReadyGameStackVerification;
  katana: ReadyGameStackKatanaArtifact;
  torii: ReadyGameStackToriiArtifact;
}

export interface ActiveGameStackPublicationIdentity {
  gameStackId: string;
  activeUntil: string;
  publicationRevision: number;
}

type ReadyProductionRuntimeRegistrationBase = RegisterRuntimeArtifactOptions & {
  scope: "game";
  provider: "aws";
  activate: true;
  publicationClass: "ready-game-stack";
  environmentId: "mainnet.blitz";
  runtimeName: string;
  runtimeInstanceId: string;
  imageDigest: string;
  routingShard: number;
  activeUntil: string;
  publicationRevision: number;
  attestationMeasurement?: string;
};

type ReadyProductionRuntimeRegistration = ReadyProductionRuntimeRegistrationBase &
  (
    | { runtimeKind: "katana"; endpoints: ReadyGameStackKatanaArtifact["endpoints"] }
    | { runtimeKind: "torii"; endpoints: ReadyGameStackToriiArtifact["endpoints"] }
  );

export function registerReadyGameStack(
  registryValue: RuntimeRegistryV1 | string,
  gameStack: ReadyGameStackRegistration,
  now: Date = new Date(),
): RuntimeRegistryV1 {
  validateReadyGameStackRegistration(gameStack, now);
  const currentRegistry = parseRuntimeRegistry(registryValue);
  const publicationRevision = currentRegistry.revision + 1;
  const updatedRegistry = registerRuntimeEndpointRegistrations(
    currentRegistry,
    buildReadyGameStackRuntimeRegistrations(gameStack, publicationRevision),
    now,
  );
  return {
    ...updatedRegistry,
    activeGameStacks: {
      ...updatedRegistry.activeGameStacks,
      [gameStack.environmentId]: {
        gameStackId: gameStack.gameStackId,
        activeUntil: gameStack.activeUntil,
        publicationRevision,
        attestationMeasurement: gameStack.attestationMeasurement,
        verification: gameStack.verification,
      },
    },
  };
}

export function registerRuntimeArtifact(
  registryValue: RuntimeRegistryV1 | string,
  artifact: RegistryRuntimeArtifact,
  options: RegisterRuntimeArtifactOptions,
): RuntimeRegistryV1 {
  validateRegistryArtifact(artifact);

  return registerRuntimeEndpointRegistrations(registryValue, [
    {
      ...options,
      environmentId: artifact.environmentId,
      runtimeKind: artifact.runtimeKind,
      runtimeName: artifact.runtimeName,
      endpoints: artifact.endpoints,
      runtimeInstanceId: artifact.runtimeInstanceId,
      imageDigest: artifact.imageDigest,
      routingShard: artifact.routingShard,
    },
  ]);
}

export function registerRuntimeEndpointRegistrations(
  registryValue: RuntimeRegistryV1 | string,
  registrations: RuntimeEndpointRegistration[],
  generatedAt: Date = new Date(),
): RuntimeRegistryV1 {
  if (registrations.length === 0) {
    throw new Error("Runtime registry update requires at least one endpoint registration");
  }

  const registry = parseRuntimeRegistry(registryValue);
  const aliases = { ...registry.aliases };
  for (const registration of registrations) {
    validateEndpointRegistration(registration);
    applyEndpointRegistration(aliases, registration);
  }

  return {
    ...registry,
    revision: registry.revision + 1,
    generatedAt: generatedAt.toISOString(),
    aliases,
  };
}

function applyEndpointRegistration(
  aliases: RuntimeRegistryV1["aliases"],
  registration: RuntimeEndpointRegistration,
): void {
  for (const [endpointKind, endpoint] of Object.entries(registration.endpoints) as Array<
    [RuntimeEndpointKind, string]
  >) {
    if (!endpoint) {
      continue;
    }

    const alias = buildArtifactAlias(registration, registration.scope, endpointKind);
    aliases[alias] = buildRegisteredRuntimeAlias(registration, endpointKind, endpoint, aliases[alias]);
  }
}

function buildRegisteredRuntimeAlias(
  registration: RuntimeEndpointRegistration,
  endpointKind: RuntimeEndpointKind,
  endpoint: string,
  current: RuntimeEndpointAlias | undefined,
): RuntimeEndpointAlias {
  if (registration.publicationClass === "ready-game-stack") {
    return buildReadyProductionRuntimeAlias(requireReadyProductionRegistration(registration), endpointKind, endpoint);
  }
  return buildLegacyRuntimeAlias(registration, endpointKind, endpoint, current);
}

function buildReadyProductionRuntimeAlias(
  registration: ReadyProductionRuntimeRegistration,
  endpointKind: RuntimeEndpointKind,
  endpoint: string,
): RuntimeEndpointAlias {
  return {
    scope: registration.scope,
    environmentId: registration.environmentId,
    runtimeKind: registration.runtimeKind,
    endpointKind,
    activeProvider: "aws",
    providers: { aws: endpoint },
    runtimeName: registration.runtimeName,
    runtimeInstanceId: registration.runtimeInstanceId,
    imageDigest: registration.imageDigest,
    routingShard: registration.routingShard,
    activeUntil: registration.activeUntil,
    publicationRevision: registration.publicationRevision,
    attestationMeasurement: registration.attestationMeasurement,
  };
}

function buildLegacyRuntimeAlias(
  registration: RuntimeEndpointRegistration,
  endpointKind: RuntimeEndpointKind,
  endpoint: string,
  current: RuntimeEndpointAlias | undefined,
): RuntimeEndpointAlias {
  const fallbackEndpoint = resolveLegacyFallbackEndpoint(registration, endpointKind, endpoint, current);
  return {
    scope: registration.scope,
    environmentId: registration.environmentId,
    runtimeKind: registration.runtimeKind,
    endpointKind,
    activeProvider: registration.activate ? registration.provider : current?.activeProvider || "slot",
    providers: {
      ...current?.providers,
      slot: fallbackEndpoint,
      [registration.provider]: endpoint,
    },
    runtimeName: registration.provider === "aws" ? registration.runtimeName : current?.runtimeName,
    runtimeInstanceId: registration.provider === "aws" ? registration.runtimeInstanceId : current?.runtimeInstanceId,
    imageDigest: registration.provider === "aws" ? registration.imageDigest : current?.imageDigest,
    routingShard: registration.provider === "aws" ? registration.routingShard : current?.routingShard,
  };
}

function resolveLegacyFallbackEndpoint(
  registration: RuntimeEndpointRegistration,
  endpointKind: RuntimeEndpointKind,
  endpoint: string,
  current: RuntimeEndpointAlias | undefined,
): string {
  const fallbackEndpoint =
    registration.provider === "slot"
      ? endpoint
      : current?.providers.slot || registration.fallbackEndpoints?.[endpointKind];
  if (!fallbackEndpoint) {
    const alias = buildArtifactAlias(registration, registration.scope, endpointKind);
    throw new Error(`Runtime registry alias "${alias}" requires a Slot rollback endpoint before AWS registration`);
  }
  return fallbackEndpoint;
}

export function switchRuntimeAliasProvider(
  registryValue: RuntimeRegistryV1 | string,
  aliasPrefix: string,
  provider: RuntimeRegistryProvider,
): RuntimeRegistryV1 {
  const registry = parseRuntimeRegistry(registryValue);
  const aliases = { ...registry.aliases };
  const matchingAliases = Object.entries(aliases).filter(([alias]) => alias.startsWith(aliasPrefix));
  if (matchingAliases.length === 0) {
    throw new Error(`Runtime registry alias prefix "${aliasPrefix}" did not match any aliases`);
  }

  for (const [alias, entry] of matchingAliases) {
    if (!entry.providers[provider]) {
      throw new Error(`Runtime registry alias "${alias}" has no ${provider} endpoint`);
    }
    aliases[alias] = { ...entry, activeProvider: provider };
  }

  return {
    ...registry,
    revision: registry.revision + 1,
    generatedAt: new Date().toISOString(),
    aliases,
  };
}

export function removeRuntimeArtifact(
  registryValue: RuntimeRegistryV1 | string,
  runtimeInstanceId: string,
): RuntimeRegistryV1 {
  return removeRuntimeArtifacts(registryValue, [runtimeInstanceId]);
}

export function removeActiveGameStackPublication(
  registryValue: RuntimeRegistryV1 | string,
  identity: ActiveGameStackPublicationIdentity,
  generatedAt: Date = new Date(),
): RuntimeRegistryV1 {
  const registry = parseRuntimeRegistry(registryValue);
  const activePointer = registry.activeGameStacks?.["mainnet.blitz"];
  if (!matchesActiveGameStackPublication(activePointer, identity)) {
    return registry;
  }

  const activeGameStacks = { ...registry.activeGameStacks };
  delete activeGameStacks["mainnet.blitz"];
  return {
    ...registry,
    revision: registry.revision + 1,
    generatedAt: generatedAt.toISOString(),
    activeGameStacks,
  };
}

function matchesActiveGameStackPublication(
  pointer: ActiveGameStackPointer | undefined,
  identity: ActiveGameStackPublicationIdentity,
): boolean {
  return (
    pointer?.gameStackId === identity.gameStackId &&
    pointer.activeUntil === identity.activeUntil &&
    pointer.publicationRevision === identity.publicationRevision
  );
}

export function removeRuntimeArtifacts(
  registryValue: RuntimeRegistryV1 | string,
  runtimeInstanceIds: string[],
): RuntimeRegistryV1 {
  const registry = parseRuntimeRegistry(registryValue);
  const aliases = { ...registry.aliases };
  const immutableIds = new Set(runtimeInstanceIds);
  const matchingAliases = Object.entries(aliases).filter(
    ([, entry]) => entry.runtimeInstanceId && immutableIds.has(entry.runtimeInstanceId),
  );
  if (matchingAliases.length === 0) {
    return registry;
  }

  for (const [alias, entry] of matchingAliases) {
    if (!entry.providers.slot) {
      delete aliases[alias];
      continue;
    }
    const { aws: _aws, ...providers } = entry.providers;
    aliases[alias] = {
      ...entry,
      activeProvider: "slot",
      providers,
      runtimeName: undefined,
      runtimeInstanceId: undefined,
      imageDigest: undefined,
      routingShard: undefined,
      activeUntil: undefined,
      publicationRevision: undefined,
      attestationMeasurement: undefined,
    };
  }

  const activeGameStacks = { ...registry.activeGameStacks };
  const activeBlitzStack = activeGameStacks["mainnet.blitz"];
  if (activeBlitzStack && matchingAliases.some(([, entry]) => entry.runtimeName === activeBlitzStack.gameStackId)) {
    delete activeGameStacks["mainnet.blitz"];
  }

  return {
    ...registry,
    revision: registry.revision + 1,
    generatedAt: new Date().toISOString(),
    aliases,
    activeGameStacks,
  };
}

function buildArtifactAlias(
  artifact: Pick<RegistryRuntimeArtifact, "environmentId" | "runtimeKind" | "runtimeName">,
  scope: RuntimeAliasScope,
  endpointKind: RuntimeEndpointKind,
): string {
  const [chain, gameType = "blitz"] = artifact.environmentId.split(".");
  switch (scope) {
    case "factory":
      return buildFactoryRuntimeAlias(chain, gameType === "eternum" ? "eternum" : "blitz").replace(
        /\.sql$/,
        `.${endpointKind}`,
      );
    case "global":
      return buildGlobalRuntimeAlias(chain).replace(/\.base$/, `.${endpointKind}`);
    case "shared-chain":
      return buildSharedChainRuntimeAlias(chain).replace(/\.(rpc|base|health|sql)$/, `.${endpointKind}`);
    case "game":
      return buildGameRuntimeAlias(artifact.environmentId, artifact.runtimeName, artifact.runtimeKind, endpointKind);
  }
}

function validateEndpointRegistration(registration: RuntimeEndpointRegistration): void {
  if (
    registration.environmentId === "mainnet.blitz" &&
    registration.provider === "aws" &&
    registration.publicationClass !== "ready-game-stack"
  ) {
    throw new Error("Production Blitz runtimes must be published as one complete ready game stack");
  }

  if (
    registration.publicationClass === "ready-game-stack" &&
    (!registration.activeUntil ||
      !Number.isFinite(Date.parse(registration.activeUntil)) ||
      !Number.isInteger(registration.publicationRevision))
  ) {
    throw new Error("Production Blitz game-stack publication requires valid activeUntil and publicationRevision");
  }

  if (registration.provider === "aws") {
    if (!registration.runtimeInstanceId || !registration.imageDigest || !Number.isInteger(registration.routingShard)) {
      throw new Error("AWS runtime registry registration requires identity, imageDigest, and routingShard");
    }
  }

  const requiredEndpoints =
    registration.runtimeKind === "katana" ? (["base", "health", "rpc"] as const) : (["base", "health", "sql"] as const);
  const missingEndpoints = requiredEndpoints.filter((endpointKind) => !registration.endpoints?.[endpointKind]);
  if (missingEndpoints.length > 0) {
    throw new Error(`Runtime registry registration is missing endpoints: ${missingEndpoints.join(", ")}`);
  }
}

function validateReadyGameStackRegistration(gameStack: ReadyGameStackRegistration, now: Date): void {
  if (!/^sha384:[a-f0-9]{96}$/.test(gameStack.attestationMeasurement)) {
    throw new Error("Production Blitz game-stack publication requires a verified SEV-SNP measurement");
  }
  const verificationTimestamps = [
    gameStack.verification.identitySealedAt,
    gameStack.verification.attestationVerifiedAt,
    gameStack.verification.worldReadyAt,
    gameStack.verification.indexerReadyAt,
    gameStack.verification.registryVerifiedAt,
  ].map((value) => Date.parse(value));
  const hasAllVerificationSteps = hasExactReadyVerificationKeys(gameStack.verification);
  const isOrdered = verificationTimestamps.every(
    (timestamp, index) => index === 0 || timestamp >= verificationTimestamps[index - 1]!,
  );
  const isComplete = verificationTimestamps.every(Number.isFinite) && verificationTimestamps.at(-1)! <= now.getTime();
  if (!hasAllVerificationSteps || !isOrdered || !isComplete) {
    throw new Error(
      "Production Blitz game-stack publication requires complete, ordered, non-future readiness evidence",
    );
  }
}

function hasExactReadyVerificationKeys(verification: ReadyGameStackVerification): boolean {
  const expectedKeys = [
    "attestationVerifiedAt",
    "identitySealedAt",
    "indexerReadyAt",
    "registryVerifiedAt",
    "worldReadyAt",
  ];
  return Object.keys(verification).sort().join(",") === expectedKeys.join(",");
}

function requireReadyProductionRegistration(
  registration: RuntimeEndpointRegistration,
): ReadyProductionRuntimeRegistration {
  if (!isCompleteReadyProductionRegistration(registration)) {
    throw new Error("Production Blitz game-stack runtime registration is incomplete");
  }
  return registration;
}

function isCompleteReadyProductionRegistration(
  registration: RuntimeEndpointRegistration,
): registration is ReadyProductionRuntimeRegistration {
  const hasRequiredIdentity =
    Boolean(registration.runtimeInstanceId) &&
    Boolean(registration.imageDigest) &&
    Number.isInteger(registration.routingShard);
  const hasRequiredPublication =
    Boolean(registration.activeUntil) && Number.isInteger(registration.publicationRevision);
  const hasExactEndpoints =
    registration.runtimeKind === "katana"
      ? hasExactEndpointKeys(registration.endpoints, ["base", "health", "rpc"])
      : hasExactEndpointKeys(registration.endpoints, ["base", "health", "sql"]);
  return (
    registration.scope === "game" &&
    registration.provider === "aws" &&
    registration.activate === true &&
    registration.publicationClass === "ready-game-stack" &&
    registration.environmentId === "mainnet.blitz" &&
    hasRequiredIdentity &&
    hasRequiredPublication &&
    hasExactEndpoints
  );
}

function hasExactEndpointKeys(
  endpoints: Partial<Record<RuntimeEndpointKind, string>>,
  expectedKeys: RuntimeEndpointKind[],
): boolean {
  return Object.keys(endpoints).sort().join(",") === [...expectedKeys].sort().join(",");
}

function buildReadyGameStackRuntimeRegistrations(
  gameStack: ReadyGameStackRegistration,
  publicationRevision: number,
): ReadyProductionRuntimeRegistration[] {
  const shared = {
    scope: "game" as const,
    provider: "aws" as const,
    activate: true as const,
    publicationClass: "ready-game-stack" as const,
    environmentId: gameStack.environmentId,
    runtimeName: gameStack.gameStackId,
    activeUntil: gameStack.activeUntil,
    publicationRevision,
    attestationMeasurement: gameStack.attestationMeasurement,
  };
  return [
    {
      ...shared,
      runtimeKind: "katana",
      ...gameStack.katana,
    },
    {
      ...shared,
      runtimeKind: "torii",
      ...gameStack.torii,
    },
  ];
}

function validateRegistryArtifact(artifact: RegistryRuntimeArtifact): void {
  if (artifact.schemaVersion !== 2) {
    throw new Error("Runtime registry registration requires AwsRuntimeArtifact schemaVersion 2");
  }
}
