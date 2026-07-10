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
}

export interface RuntimeRegistryV1 {
  schemaVersion: typeof RUNTIME_REGISTRY_SCHEMA_VERSION;
  revision: number;
  generatedAt: string;
  aliases: Record<string, RuntimeEndpointAlias>;
}

export interface ResolveRuntimeAliasOptions {
  provider?: RuntimeRegistryProvider;
  registry?: RuntimeRegistryV1;
}

export interface LoadRuntimeRegistryOptions {
  embedded?: RuntimeRegistryV1 | string;
  fetchImpl?: typeof fetch;
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
    "factory.mainnet.blitz.torii.sql": slotAlias(
      "factory",
      "mainnet.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/eternum-factory-mainnet/torii/sql",
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
    "global.mainnet.blitz.torii.base": slotAlias(
      "global",
      "mainnet.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/blitz-mainnet-global-1/torii",
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
    "game.mainnet.blitz.s0-game-1.torii.sql": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/s0-game-1/torii/sql",
    ),
    "game.mainnet.blitz.s0-game-1.torii.base": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/s0-game-1/torii",
    ),
    "game.mainnet.blitz.s0-game-2.torii.sql": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/s0-game-2/torii/sql",
    ),
    "game.mainnet.blitz.s0-game-2.torii.base": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/s0-game-2/torii",
    ),
    "game.mainnet.blitz.s0-game-3.torii.sql": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/s0-game-3/torii/sql",
    ),
    "game.mainnet.blitz.s0-game-3.torii.base": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/s0-game-3/torii",
    ),
    "game.mainnet.blitz.s0-game-4.torii.sql": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "sql",
      "https://api.cartridge.gg/x/s0-game-4/torii/sql",
    ),
    "game.mainnet.blitz.s0-game-4.torii.base": slotAlias(
      "game",
      "mainnet.blitz",
      "torii",
      "base",
      "https://api.cartridge.gg/x/s0-game-4/torii",
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
    return fallback;
  }

  try {
    const registry = await fetchRuntimeRegistryWithTimeout(registryUrl, options);
    return {
      registry: installRuntimeRegistry(registry),
      source: "remote",
    };
  } catch (error) {
    return {
      ...fallback,
      remoteError: error instanceof Error ? error.message : String(error),
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
