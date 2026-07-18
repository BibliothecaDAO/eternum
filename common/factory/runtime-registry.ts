export const RUNTIME_REGISTRY_SCHEMA_VERSION = "realms-runtime-registry/v1" as const;
const RUNTIME_INSTANCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IMAGE_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export type RuntimeRegistryProvider = "slot" | "aws";
export type RuntimeAliasScope = "factory" | "global" | "shared-chain" | "game";

export interface RuntimeEndpointAlias {
  scope: RuntimeAliasScope;
  environmentId: string;
  runtimeKind: "katana" | "torii" | "chain-rpc";
  endpointKind: "base" | "health" | "rpc" | "sql";
  activeProvider: RuntimeRegistryProvider;
  providers: Partial<Record<RuntimeRegistryProvider, string>>;
  runtimeName?: string;
  runtimeInstanceId?: string;
  imageDigest?: string;
  routingShard?: number;
  activeUntil?: string;
  publicationRevision?: number;
  attestationMeasurement?: string;
}

export interface RuntimeReadinessEvidence {
  identitySealedAt: string;
  attestationVerifiedAt: string;
  worldReadyAt: string;
  indexerReadyAt: string;
  registryVerifiedAt: string;
}

export interface ActiveGameStackPointer {
  gameStackId: string;
  activeUntil: string;
  publicationRevision: number;
  attestationMeasurement: string;
  verification: RuntimeReadinessEvidence;
}

export interface RuntimeRegistryV1 {
  schemaVersion: typeof RUNTIME_REGISTRY_SCHEMA_VERSION;
  revision: number;
  generatedAt: string;
  aliases: Record<string, RuntimeEndpointAlias>;
  activeGameStacks?: Record<string, ActiveGameStackPointer>;
}

export interface ResolveRuntimeAliasOptions {
  provider?: RuntimeRegistryProvider;
  registry?: RuntimeRegistryV1;
}

export interface LoadRuntimeRegistryOptions {
  embedded?: RuntimeRegistryV1 | string;
  fetchImpl?: typeof fetch;
  required?: boolean;
  timeoutMs?: number;
  url?: string;
}

export interface RuntimeRegistryLoadResult {
  registry: RuntimeRegistryV1;
  remoteError?: string;
  source: "default" | "embedded" | "remote";
}

const DEFAULT_SLOT_REGISTRY: RuntimeRegistryV1 = {
  schemaVersion: RUNTIME_REGISTRY_SCHEMA_VERSION,
  revision: 1,
  generatedAt: "2026-07-10T00:00:00.000Z",
  aliases: {
    "factory.slot.blitz.torii.sql": slotAlias(
      "factory",
      "slot.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
    ),
    "factory.slottest.blitz.torii.sql": slotAlias(
      "factory",
      "slottest.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
    ),
    "factory.slot.eternum.torii.sql": slotAlias(
      "factory",
      "slot.eternum",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
    ),
    "factory.slottest.eternum.torii.sql": slotAlias(
      "factory",
      "slottest.eternum",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
    ),
    "factory.mainnet.eternum.torii.sql": slotAlias(
      "factory",
      "mainnet.eternum",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-mainnet/torii/sql",
    ),
    "factory.sepolia.blitz.torii.sql": slotAlias(
      "factory",
      "sepolia.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-sepolia/torii/sql",
    ),
    "global.slot.blitz.torii.base": slotAlias(
      "global",
      "slot.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/blitz-slot-global-1/torii",
    ),
    "global.slottest.blitz.torii.base": slotAlias(
      "global",
      "slottest.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/blitz-slot-global-1/torii",
    ),
    "shared-chain.slot.katana.rpc": slotAlias(
      "shared-chain",
      "slot.blitz",
      "katana",
      "rpc",
      "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
    ),
    "shared-chain.slottest.katana.rpc": slotAlias(
      "shared-chain",
      "slottest.blitz",
      "katana",
      "rpc",
      "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana/rpc/v0_9",
    ),
    "shared-chain.mainnet.chain-rpc.rpc": slotAlias(
      "shared-chain",
      "mainnet.blitz",
      "chain-rpc",
      "rpc",
      "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9",
    ),
    "shared-chain.sepolia.chain-rpc.rpc": slotAlias(
      "shared-chain",
      "sepolia.blitz",
      "chain-rpc",
      "rpc",
      "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
    ),
    "game.mainnet.eternum.eternum-marketplace-mainnet19.torii.base": slotAlias(
      "game",
      "mainnet.eternum",
      "torii",
      "base",
      "https://api.cartridge.gg/x/eternum-marketplace-mainnet19/torii",
    ),
    "game.sepolia.eternum.eternum-marketplace-sepolia-1.torii.base": slotAlias(
      "game",
      "sepolia.eternum",
      "torii",
      "base",
      "https://api.cartridge.gg/x/eternum-marketplace-sepolia-1/torii",
    ),
  },
};

let installedRegistry: RuntimeRegistryV1 | undefined;

export function getDefaultRuntimeRegistry(): RuntimeRegistryV1 {
  return DEFAULT_SLOT_REGISTRY;
}

function installRuntimeRegistry(registry: RuntimeRegistryV1 | string): RuntimeRegistryV1 {
  installedRegistry = parseRuntimeRegistry(registry);
  return installedRegistry;
}

export function clearInstalledRuntimeRegistry(): void {
  installedRegistry = undefined;
}

export function resolveRuntimeEndpointAlias(alias: string, options: ResolveRuntimeAliasOptions = {}): string {
  const registry =
    options.registry || installedRegistry || readRuntimeRegistryFromEnvironment() || DEFAULT_SLOT_REGISTRY;
  const entry = registry.aliases[alias];
  if (!entry) {
    throw new Error(`Runtime registry alias "${alias}" is not registered`);
  }

  const provider = options.provider || entry.activeProvider;
  const endpoint = entry.providers[provider];
  if (!endpoint) {
    throw new Error(`Runtime registry alias "${alias}" has no ${provider} rollback target`);
  }
  return endpoint;
}

async function fetchRuntimeRegistry(
  url: string,
  fetchImpl: typeof fetch = fetch,
  requestOptions: RequestInit = {},
): Promise<RuntimeRegistryV1> {
  const headers = new Headers(requestOptions.headers);
  headers.set("Accept", "application/json");
  const uncachedRequest = {
    ...requestOptions,
    cache: "no-store" as const,
    headers,
  };
  const response = await fetchImpl(url, uncachedRequest);
  if (!response.ok) {
    throw new Error(`Runtime registry request failed: ${response.status} ${response.statusText}`);
  }
  return parseRuntimeRegistry(await response.json());
}

export async function loadRuntimeRegistry(
  options: LoadRuntimeRegistryOptions = {},
): Promise<RuntimeRegistryLoadResult> {
  const fallback = installFallbackRegistry(options.embedded);
  const registryUrl = options.url?.trim();
  if (!registryUrl) {
    if (options.required) {
      throw new Error("Required runtime registry URL is missing");
    }
    return fallback;
  }

  try {
    const registry = await fetchRuntimeRegistryWithTimeout(registryUrl, options);
    return {
      registry: installRuntimeRegistry(registry),
      source: "remote",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.required) {
      throw new Error(`Required runtime registry is unavailable: ${message}`);
    }
    return {
      ...fallback,
      remoteError: message,
    };
  }
}

export function parseRuntimeRegistry(value: unknown): RuntimeRegistryV1 {
  const parsed = typeof value === "string" ? parseRegistryJson(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Runtime registry must be an object");
  }

  const registry = parsed as Partial<RuntimeRegistryV1>;
  if (registry.schemaVersion !== RUNTIME_REGISTRY_SCHEMA_VERSION) {
    throw new Error(`Unsupported runtime registry schemaVersion "${registry.schemaVersion || ""}"`);
  }
  if (!Number.isInteger(registry.revision) || (registry.revision || 0) < 1) {
    throw new Error("Runtime registry revision must be a positive integer");
  }
  if (!registry.generatedAt || !Number.isFinite(Date.parse(registry.generatedAt))) {
    throw new Error("Runtime registry generatedAt must be an ISO timestamp");
  }
  if (!registry.aliases || typeof registry.aliases !== "object" || Array.isArray(registry.aliases)) {
    throw new Error("Runtime registry aliases must be an object");
  }

  for (const [alias, entry] of Object.entries(registry.aliases)) {
    validateRuntimeAlias(alias, entry);
  }
  if (registry.activeGameStacks !== undefined) {
    validateActiveGameStackPointers(registry.activeGameStacks, registry.revision || 0, new Date(registry.generatedAt));
  }
  return registry as RuntimeRegistryV1;
}

export function buildFactoryRuntimeAlias(chain: string, gameType: "blitz" | "eternum" = "blitz"): string {
  const registryChain = chain === "local" ? "slot" : chain;
  const registryGameType = registryChain === "sepolia" ? "blitz" : gameType;
  return `factory.${registryChain}.${registryGameType}.torii.sql`;
}

export function buildGlobalRuntimeAlias(chain: string): string {
  return `global.${chain}.blitz.torii.base`;
}

export function buildSharedChainRuntimeAlias(chain: string): string {
  if (chain === "slot" || chain === "slottest") {
    return `shared-chain.${chain}.katana.rpc`;
  }
  return `shared-chain.${chain}.chain-rpc.rpc`;
}

export function buildGameRuntimeAlias(
  environmentId: string,
  runtimeName: string,
  runtimeKind: "katana" | "torii",
  endpointKind: "base" | "health" | "rpc" | "sql",
): string {
  return `game.${environmentId}.${runtimeName}.${runtimeKind}.${endpointKind}`;
}

export function assertCompleteActiveGameStack(
  registry: RuntimeRegistryV1,
  gameStackId: string,
  now: Date = new Date(),
): void {
  const activePointer = registry.activeGameStacks?.["mainnet.blitz"];
  if (!matchesRequestedActiveStack(activePointer, gameStackId)) {
    throw new Error(`Blitz game stack "${gameStackId}" is not the registry's active stack`);
  }
  if (!isActiveGameStackPointerUnexpired(activePointer, now)) {
    throw new Error(`Active Blitz game stack "${gameStackId}" is expired`);
  }
  if (!hasVerifiedAttestationMeasurement(activePointer)) {
    throw new Error(`Active Blitz game stack "${gameStackId}" has no verified attestation measurement`);
  }
  if (!hasCompleteReadinessEvidence(activePointer, now)) {
    throw new Error(`Active Blitz game stack "${gameStackId}" has future-dated readiness evidence`);
  }

  const requiredAliases = [
    buildGameRuntimeAlias("mainnet.blitz", gameStackId, "katana", "base"),
    buildGameRuntimeAlias("mainnet.blitz", gameStackId, "katana", "health"),
    buildGameRuntimeAlias("mainnet.blitz", gameStackId, "katana", "rpc"),
    buildGameRuntimeAlias("mainnet.blitz", gameStackId, "torii", "base"),
    buildGameRuntimeAlias("mainnet.blitz", gameStackId, "torii", "health"),
    buildGameRuntimeAlias("mainnet.blitz", gameStackId, "torii", "sql"),
  ];
  const entries = requiredAliases.map((alias) => [alias, registry.aliases[alias]] as const);
  const missingAliases = entries.filter(([, entry]) => !entry).map(([alias]) => alias);
  if (missingAliases.length > 0) {
    throw new Error(`Active Blitz game stack is incomplete: ${missingAliases.join(", ")}`);
  }

  for (const [alias, entry] of entries) {
    if (!entry || !isAwsOnlyImmutableGameStackAlias(entry, gameStackId, activePointer)) {
      throw new Error(`Active Blitz game stack alias "${alias}" is not an AWS-only immutable runtime`);
    }
    if (!matchesActiveGameStackWindow(entry, activePointer, now)) {
      throw new Error(`Active Blitz game stack alias "${alias}" is expired or missing activeUntil`);
    }
  }
}

function validateActiveGameStackPointers(
  activeGameStacks: Record<string, ActiveGameStackPointer>,
  registryRevision: number,
  generatedAt: Date,
): void {
  for (const [environmentId, pointer] of Object.entries(activeGameStacks)) {
    if (environmentId !== "mainnet.blitz") {
      throw new Error(`Runtime registry has an unsupported active game-stack environment "${environmentId}"`);
    }
    if (!hasValidActiveGameStackIdentity(pointer)) {
      throw new Error(`Runtime registry active game stack "${environmentId}" is invalid`);
    }
    if (!hasCompleteReadinessEvidence(pointer, generatedAt)) {
      throw new Error(`Runtime registry active game stack "${environmentId}" has invalid readiness evidence`);
    }
    if (!hasValidPublicationRevision(pointer, registryRevision)) {
      throw new Error(`Runtime registry active game stack "${environmentId}" has an invalid publicationRevision`);
    }
  }
}

function matchesRequestedActiveStack(
  pointer: ActiveGameStackPointer | undefined,
  gameStackId: string,
): pointer is ActiveGameStackPointer {
  return pointer?.gameStackId === gameStackId;
}

function isActiveGameStackPointerUnexpired(pointer: ActiveGameStackPointer, now: Date): boolean {
  return Date.parse(pointer.activeUntil) > now.getTime();
}

function hasVerifiedAttestationMeasurement(pointer: ActiveGameStackPointer): boolean {
  return /^sha384:[a-f0-9]{96}$/.test(pointer.attestationMeasurement);
}

function isAwsOnlyImmutableGameStackAlias(
  entry: RuntimeEndpointAlias,
  gameStackId: string,
  pointer: ActiveGameStackPointer,
): boolean {
  const hasOnlyAwsEndpoint = entry.activeProvider === "aws" && Object.keys(entry.providers).length === 1;
  const matchesImmutableStack =
    Boolean(entry.providers.aws) &&
    entry.runtimeName === gameStackId &&
    entry.publicationRevision === pointer.publicationRevision;
  const matchesAttestation =
    entry.runtimeKind !== "katana" || entry.attestationMeasurement === pointer.attestationMeasurement;
  return hasOnlyAwsEndpoint && matchesImmutableStack && matchesAttestation;
}

function matchesActiveGameStackWindow(
  entry: RuntimeEndpointAlias,
  pointer: ActiveGameStackPointer,
  now: Date,
): boolean {
  return entry.activeUntil === pointer.activeUntil && Date.parse(entry.activeUntil) > now.getTime();
}

function hasValidActiveGameStackIdentity(
  pointer: ActiveGameStackPointer | undefined,
): pointer is ActiveGameStackPointer {
  return Boolean(pointer?.gameStackId) && Number.isFinite(Date.parse(pointer?.activeUntil || ""));
}

function hasCompleteReadinessEvidence(pointer: ActiveGameStackPointer, generatedAt: Date): boolean {
  return (
    hasVerifiedAttestationMeasurement(pointer) &&
    hasExactReadinessEvidenceKeys(pointer.verification) &&
    hasOrderedReadinessEvidence(pointer.verification, generatedAt)
  );
}

function hasExactReadinessEvidenceKeys(verification: RuntimeReadinessEvidence | undefined): boolean {
  const expectedKeys = [
    "identitySealedAt",
    "attestationVerifiedAt",
    "worldReadyAt",
    "indexerReadyAt",
    "registryVerifiedAt",
  ];
  return (
    Boolean(verification) &&
    Object.keys(verification || {})
      .sort()
      .join(",") === expectedKeys.sort().join(",")
  );
}

function hasOrderedReadinessEvidence(verification: RuntimeReadinessEvidence, generatedAt: Date): boolean {
  const timestamps = [
    verification.identitySealedAt,
    verification.attestationVerifiedAt,
    verification.worldReadyAt,
    verification.indexerReadyAt,
    verification.registryVerifiedAt,
  ].map((value) => Date.parse(value));
  return (
    timestamps.every(Number.isFinite) &&
    timestamps.every((timestamp, index) => index === 0 || timestamp >= timestamps[index - 1]!) &&
    timestamps.at(-1)! <= generatedAt.getTime()
  );
}

function hasValidPublicationRevision(pointer: ActiveGameStackPointer, registryRevision: number): boolean {
  return (
    Number.isInteger(pointer.publicationRevision) &&
    pointer.publicationRevision >= 1 &&
    pointer.publicationRevision <= registryRevision
  );
}

function slotAlias(
  scope: RuntimeAliasScope,
  environmentId: string,
  runtimeKind: RuntimeEndpointAlias["runtimeKind"],
  endpointKind: RuntimeEndpointAlias["endpointKind"],
  endpoint: string,
): RuntimeEndpointAlias {
  return {
    scope,
    environmentId,
    runtimeKind,
    endpointKind,
    activeProvider: "slot",
    providers: { slot: endpoint },
  };
}

function parseRegistryJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Runtime registry JSON is invalid");
  }
}

function validateRuntimeAlias(alias: string, entry: RuntimeEndpointAlias): void {
  if (!/^[a-z0-9.-]+$/.test(alias)) {
    throw new Error(`Runtime registry alias "${alias}" is not canonical`);
  }
  if (!entry || typeof entry !== "object" || !["slot", "aws"].includes(entry.activeProvider)) {
    throw new Error(`Runtime registry alias "${alias}" has an invalid activeProvider`);
  }
  if (!["factory", "global", "shared-chain", "game"].includes(entry.scope)) {
    throw new Error(`Runtime registry alias "${alias}" has an invalid scope`);
  }
  if (!/^[a-z0-9.-]+$/.test(entry.environmentId)) {
    throw new Error(`Runtime registry alias "${alias}" has an invalid environmentId`);
  }
  if (!["katana", "torii", "chain-rpc"].includes(entry.runtimeKind)) {
    throw new Error(`Runtime registry alias "${alias}" has an invalid runtimeKind`);
  }
  if (!["base", "health", "rpc", "sql"].includes(entry.endpointKind)) {
    throw new Error(`Runtime registry alias "${alias}" has an invalid endpointKind`);
  }
  if (!entry.providers || typeof entry.providers !== "object") {
    throw new Error(`Runtime registry alias "${alias}" has no provider endpoints`);
  }
  for (const [provider, endpoint] of Object.entries(entry.providers)) {
    if (!(["slot", "aws"] as string[]).includes(provider)) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid provider "${provider}"`);
    }
    if (!endpoint || !isAllowedRegistryUrl(endpoint)) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid ${provider} endpoint`);
    }
  }
  if (!entry.providers[entry.activeProvider]) {
    throw new Error(`Runtime registry alias "${alias}" is missing its active provider endpoint`);
  }
  if (entry.providers.aws) {
    if (!entry.runtimeName || !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(entry.runtimeName)) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid runtimeName`);
    }
    if (!entry.runtimeInstanceId || !RUNTIME_INSTANCE_ID_PATTERN.test(entry.runtimeInstanceId)) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid runtimeInstanceId`);
    }
    if (!entry.imageDigest || !IMAGE_DIGEST_PATTERN.test(entry.imageDigest)) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid imageDigest`);
    }
    if (!Number.isInteger(entry.routingShard) || (entry.routingShard || 0) < 0) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid routingShard`);
    }
    if (entry.activeUntil !== undefined && !Number.isFinite(Date.parse(entry.activeUntil))) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid activeUntil`);
    }
    if (
      entry.publicationRevision !== undefined &&
      (!Number.isInteger(entry.publicationRevision) || entry.publicationRevision < 1)
    ) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid publicationRevision`);
    }
    if (entry.attestationMeasurement !== undefined && !/^sha384:[a-f0-9]{96}$/.test(entry.attestationMeasurement)) {
      throw new Error(`Runtime registry alias "${alias}" has an invalid attestationMeasurement`);
    }
  }
}

function isAllowedRegistryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function readRuntimeRegistryFromEnvironment(): RuntimeRegistryV1 | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  const value = (process as any).env?.RUNTIME_REGISTRY_JSON;
  return typeof value === "string" && value.trim() ? parseRuntimeRegistry(value) : undefined;
}

function installFallbackRegistry(embedded: LoadRuntimeRegistryOptions["embedded"]): RuntimeRegistryLoadResult {
  if (typeof embedded === "string" && !embedded.trim()) {
    embedded = undefined;
  }
  const registry = installRuntimeRegistry(embedded || DEFAULT_SLOT_REGISTRY);
  return {
    registry,
    source: embedded ? "embedded" : "default",
  };
}

async function fetchRuntimeRegistryWithTimeout(
  url: string,
  options: LoadRuntimeRegistryOptions,
): Promise<RuntimeRegistryV1> {
  const timeoutMs = resolveRegistryTimeout(options.timeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchRuntimeRegistry(url, options.fetchImpl || fetch, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function resolveRegistryTimeout(timeoutMs: number | undefined): number {
  return Number.isFinite(timeoutMs) && (timeoutMs || 0) > 0 ? Number(timeoutMs) : 5_000;
}
