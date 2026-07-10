import {
  buildFactoryRuntimeAlias,
  buildGameRuntimeAlias,
  buildGlobalRuntimeAlias,
  buildSharedChainRuntimeAlias,
  parseRuntimeRegistry,
  type RuntimeAliasScope,
  type RuntimeEndpointAlias,
  type RuntimeRegistryProvider,
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
    generatedAt: new Date().toISOString(),
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
    const current = aliases[alias];
    const fallbackEndpoint =
      registration.provider === "slot"
        ? endpoint
        : current?.providers.slot || registration.fallbackEndpoints?.[endpointKind];
    if (!fallbackEndpoint) {
      throw new Error(`Runtime registry alias "${alias}" requires a Slot rollback endpoint before AWS registration`);
    }

    aliases[alias] = {
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
    } satisfies RuntimeEndpointAlias;
  }
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
      throw new Error(`Runtime registry alias "${alias}" cannot remove AWS without a Slot rollback endpoint`);
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
    };
  }

  return {
    ...registry,
    revision: registry.revision + 1,
    generatedAt: new Date().toISOString(),
    aliases,
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

function validateRegistryArtifact(artifact: RegistryRuntimeArtifact): void {
  if (artifact.schemaVersion !== 2) {
    throw new Error("Runtime registry registration requires AwsRuntimeArtifact schemaVersion 2");
  }
}
