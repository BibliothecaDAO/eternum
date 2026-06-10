import * as path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  DEFAULT_RAILWAY_TORII_PUBLIC_PORT,
  DEFAULT_RAILWAY_TORII_VOLUME_MOUNT_PATH,
  DEFAULT_TORII_VERSION,
} from "../constants";
import { ensureRepoDirectory } from "../shared/repo";
import type { IndexerCreationMode, IndexerLiveState, IndexerRequest, IndexerTier } from "../types";
import { renderToriiConfigArtifact } from "./torii-config";

const RAILWAY_COMMAND_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const RAILWAY_OUTPUT_DIRECTORY = ".context/railway";
const DEFAULT_RAILWAY_LINK_DIRECTORY = ".context/railway-link";
// Only treat *service*-scoped lookups as missing. Broader failures (project,
// environment, auth, ...) must stay indeterminate so we never create duplicates
// on a misconfigured CLI context.
const SERVICE_NOT_FOUND_PATTERN = /service\b[^\n]*\bnot found|could not find service/i;
const VOLUME_ALREADY_EXISTS_PATTERN = /already exists|already mounted|already has a volume/i;
const REQUIRED_RAILWAY_VARIABLE_KEYS = ["WORLD_ADDRESS", "TORII_CONFIG_BASE64"];

interface RailwayCommandInvocation {
  args: string[];
  cwd?: string;
}

export type RailwayCommandRunner = (invocation: RailwayCommandInvocation) => SpawnSyncReturns<string>;

export interface EnsureRailwayIndexerOptions {
  onProgress?: (message: string) => void;
  railwayCommandRunner?: RailwayCommandRunner;
  railwayApiToken?: string;
  railwayWorkspaceId?: string;
  railwayProjectId?: string;
  railwayEnvironmentId?: string;
  railwayWorkingDirectory?: string;
  railwayToriiImage?: string;
  railwayVolumeMountPath?: string;
  railwayPublicPort?: number;
  railwayServicePrefixes?: string[];
}

export interface RailwayIndexerActionResult {
  mode: IndexerCreationMode;
  action: "created" | "repaired" | "already-live";
  liveState: IndexerLiveState;
  requestedTier: IndexerTier;
  previousTier?: IndexerTier;
  configPath?: string;
}

export interface DeleteRailwayIndexerResult {
  action: "deleted" | "already-missing";
  liveState: IndexerLiveState;
  previousTier?: IndexerTier;
}

type RailwayServiceJson = Record<string, unknown>;

function normalizeCapturedOutput(output: string | null | undefined): string {
  return `${output || ""}`.trim();
}

function buildRailwayCommandOutput(result: Pick<SpawnSyncReturns<string>, "stdout" | "stderr">): string {
  return [normalizeCapturedOutput(result.stderr), normalizeCapturedOutput(result.stdout)].filter(Boolean).join("\n");
}

function buildRailwayCommandFailureMessage(action: string, result: SpawnSyncReturns<string>): string {
  if (result.error) {
    return `Failed to ${action}: ${result.error.message}`;
  }

  const exitCode = result.status ?? 1;
  const output = buildRailwayCommandOutput(result);
  return output ? `Failed to ${action}: ${output}` : `Failed to ${action}: railway exited with code ${exitCode}`;
}

function buildRailwayCommandRunner(options: EnsureRailwayIndexerOptions): RailwayCommandRunner {
  return (invocation) =>
    spawnSync("railway", invocation.args, {
      cwd: invocation.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: RAILWAY_COMMAND_MAX_BUFFER_BYTES,
      env: buildRailwayCommandEnv(options),
    });
}

function buildRailwayCommandEnv(options: EnsureRailwayIndexerOptions) {
  // RAILWAY_TOKEN (project token) and RAILWAY_API_TOKEN (account token) are
  // distinct credentials for the Railway CLI; never mirror one into the other.
  return {
    ...process.env,
    ...(options.railwayApiToken ? { RAILWAY_API_TOKEN: options.railwayApiToken } : {}),
  };
}

const linkedRailwayDirectories = new Set<string>();

function ensureRailwayLinkContext(options: EnsureRailwayIndexerOptions) {
  const railwayProjectId = options.railwayProjectId || process.env.RAILWAY_PROJECT_ID;
  const railwayEnvironmentId = options.railwayEnvironmentId || process.env.RAILWAY_ENVIRONMENT_ID;
  const railwayWorkspaceId = options.railwayWorkspaceId || process.env.RAILWAY_WORKSPACE_ID;

  if (!railwayProjectId) {
    throw new Error("Railway managed indexers require RAILWAY_PROJECT_ID");
  }

  if (!railwayEnvironmentId) {
    throw new Error("Railway managed indexers require RAILWAY_ENVIRONMENT_ID");
  }

  const workingDirectory =
    options.railwayWorkingDirectory ||
    ensureRepoDirectory(path.join(DEFAULT_RAILWAY_LINK_DIRECTORY, railwayProjectId, railwayEnvironmentId));
  const runner = buildRailwayCommandRunner(options);
  const linkCacheKey = [workingDirectory, railwayProjectId, railwayEnvironmentId, railwayWorkspaceId || ""].join("|");

  if (!linkedRailwayDirectories.has(linkCacheKey)) {
    const args = ["link", "--project", railwayProjectId, "--environment", railwayEnvironmentId];

    if (railwayWorkspaceId) {
      args.push("--workspace", railwayWorkspaceId);
    }

    const linkResult = runner({ args, cwd: workingDirectory });
    if ((linkResult.status ?? 1) !== 0) {
      throw new Error(buildRailwayCommandFailureMessage("link the Railway project", linkResult));
    }

    linkedRailwayDirectories.add(linkCacheKey);
  }

  return {
    cwd: workingDirectory,
    runner,
    railwayEnvironmentId,
  };
}

function resolveRailwayCommandContext(options: EnsureRailwayIndexerOptions) {
  if (options.railwayCommandRunner) {
    return {
      cwd: options.railwayWorkingDirectory,
      runner: options.railwayCommandRunner,
      railwayEnvironmentId: options.railwayEnvironmentId || process.env.RAILWAY_ENVIRONMENT_ID,
    };
  }

  return ensureRailwayLinkContext(options);
}

function parseJsonRecord(value: string): RailwayServiceJson | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as RailwayServiceJson;
    }
  } catch {}

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function findFirstRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const nested = asRecord(record[key]);
    if (nested) {
      return nested;
    }
  }

  return record;
}

function extractFirstString(record: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function extractRailwayDomain(stdout: string): string | undefined {
  const record = parseJsonRecord(stdout);
  if (!record) {
    return undefined;
  }

  const nested = findFirstRecord(record, ["domain", "serviceDomain"]);
  const domain =
    extractFirstString(record, ["domain", "hostname"]) || extractFirstString(nested, ["domain", "hostname"]);

  if (!domain) {
    return undefined;
  }

  return domain.startsWith("http://") || domain.startsWith("https://") ? domain : `https://${domain}`;
}

function extractRailwayServiceMetadata(stdout: string): {
  version?: string;
  deploymentStatus?: string;
} {
  const record = parseJsonRecord(stdout);
  if (!record) {
    return {};
  }

  const service = findFirstRecord(record, ["service"]);
  const latestDeployment = findFirstRecord(record, ["latestDeployment", "deployment"]);
  const image =
    extractFirstString(service, ["image"]) ||
    extractFirstString(latestDeployment, ["image", "dockerImage", "sourceImage"]);
  const deploymentStatus = extractFirstString(latestDeployment, ["status", "state"]);

  return {
    version: image,
    deploymentStatus,
  };
}

export function resolveRailwayToriiLiveState(
  name: string,
  options: Pick<
    EnsureRailwayIndexerOptions,
    | "onProgress"
    | "railwayCommandRunner"
    | "railwayWorkingDirectory"
    | "railwayApiToken"
    | "railwayWorkspaceId"
    | "railwayProjectId"
    | "railwayEnvironmentId"
  > = {},
): IndexerLiveState {
  const context = resolveRailwayCommandContext(options);
  const serviceResult = context.runner({
    args: ["service", name, "--json"],
    cwd: context.cwd,
  });

  if ((serviceResult.status ?? 1) !== 0) {
    const output = buildRailwayCommandOutput(serviceResult);
    if (SERVICE_NOT_FOUND_PATTERN.test(output)) {
      options.onProgress?.(`Resolved Railway Torii state for ${name} as missing`);
      return {
        state: "missing",
        stateSource: "describe-not-found",
        describeError: output,
      };
    }

    return {
      state: "indeterminate",
      stateSource: "describe-and-list-failed",
      describeError: output,
    };
  }

  const domainResult = context.runner({
    args: ["domain", "--service", name, "--json"],
    cwd: context.cwd,
  });
  const domain = (domainResult.status ?? 1) === 0 ? extractRailwayDomain(domainResult.stdout || "") : undefined;
  const metadata = extractRailwayServiceMetadata(serviceResult.stdout || "");

  options.onProgress?.(
    `Resolved Railway Torii state for ${name} as existing${metadata.deploymentStatus ? ` (${metadata.deploymentStatus})` : ""}`,
  );
  return {
    state: "existing",
    stateSource: "describe",
    url: domain,
    version: metadata.version,
    deploymentStatus: metadata.deploymentStatus,
    describedAt: new Date().toISOString(),
  };
}

export function resolveRailwayToriiLiveStates(
  gameNames: string[],
  options: Pick<
    EnsureRailwayIndexerOptions,
    | "onProgress"
    | "railwayCommandRunner"
    | "railwayWorkingDirectory"
    | "railwayApiToken"
    | "railwayWorkspaceId"
    | "railwayProjectId"
    | "railwayEnvironmentId"
  > = {},
) {
  return gameNames.map((gameName) => ({
    gameName,
    liveState: resolveRailwayToriiLiveState(gameName, options),
  }));
}

function resolveRailwayServicePrefixes(options: Pick<EnsureRailwayIndexerOptions, "railwayServicePrefixes">): string[] {
  if (options.railwayServicePrefixes) {
    return options.railwayServicePrefixes.map((value) => value.trim()).filter(Boolean);
  }

  return (process.env.RAILWAY_TORII_SERVICE_PREFIXES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function listRailwayToriiDeploymentNames(
  options: Pick<
    EnsureRailwayIndexerOptions,
    | "railwayCommandRunner"
    | "railwayWorkingDirectory"
    | "railwayApiToken"
    | "railwayWorkspaceId"
    | "railwayProjectId"
    | "railwayEnvironmentId"
    | "railwayServicePrefixes"
  > = {},
): string[] {
  const context = resolveRailwayCommandContext(options);
  const result = context.runner({
    args: ["status", "--json"],
    cwd: context.cwd,
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(buildRailwayCommandFailureMessage("list Railway services", result));
  }

  const record = parseJsonRecord(result.stdout || "");
  const services = Array.isArray(record?.services) ? record?.services : [];
  // The Railway project may host more than Torii indexers; scope the listing to
  // the configured service prefixes so account snapshots only track indexers.
  const prefixes = resolveRailwayServicePrefixes(options);

  return services
    .map((service) => {
      const serviceRecord = asRecord(service);
      return extractFirstString(serviceRecord, ["name"]);
    })
    .filter((value): value is string => Boolean(value))
    .filter((name) => prefixes.length === 0 || prefixes.some((prefix) => name.startsWith(prefix)));
}

function requireRailwayToriiImage(options: EnsureRailwayIndexerOptions) {
  const value = options.railwayToriiImage || process.env.RAILWAY_TORII_IMAGE;
  if (!value) {
    throw new Error("Railway managed indexers require RAILWAY_TORII_IMAGE");
  }

  return value;
}

function resolveRailwayVolumeMountPath(options: EnsureRailwayIndexerOptions) {
  return (
    options.railwayVolumeMountPath ||
    process.env.RAILWAY_TORII_VOLUME_MOUNT_PATH ||
    DEFAULT_RAILWAY_TORII_VOLUME_MOUNT_PATH
  );
}

function resolveRailwayPublicPort(options: EnsureRailwayIndexerOptions) {
  return (
    options.railwayPublicPort || Number(process.env.RAILWAY_TORII_PUBLIC_PORT || DEFAULT_RAILWAY_TORII_PUBLIC_PORT)
  );
}

function extractImageTag(image: string): string | undefined {
  const lastSegment = image.slice(image.lastIndexOf("/") + 1);
  const separatorIndex = lastSegment.lastIndexOf(":");
  return separatorIndex > 0 ? lastSegment.slice(separatorIndex + 1) : undefined;
}

function buildRailwayVariableArgs(
  request: IndexerRequest,
  configContents: string,
  options: EnsureRailwayIndexerOptions,
) {
  const mountPath = resolveRailwayVolumeMountPath(options);
  const imageTag = extractImageTag(requireRailwayToriiImage(options)) || DEFAULT_TORII_VERSION;

  return [
    "variables",
    "--service",
    request.worldName,
    "--skip-deploys",
    "--set",
    `RPC_URL=${request.rpcUrl}`,
    "--set",
    `WORLD_ADDRESS=${request.worldAddress}`,
    "--set",
    `TORII_NAMESPACES=${request.namespaces}`,
    "--set",
    `TORII_EXTERNAL_CONTRACTS=${(request.externalContracts || []).join(",")}`,
    "--set",
    `WORLD_BLOCK=0`,
    "--set",
    `TORII_DB_DIR=${mountPath}/torii`,
    "--set",
    `TORII_CONFIG_PATH=${mountPath}/torii.toml`,
    "--set",
    `TORII_CONFIG_BASE64=${Buffer.from(configContents, "utf8").toString("base64")}`,
    "--set",
    `PORT=${resolveRailwayPublicPort(options)}`,
    "--set",
    `TORII_IMAGE_TAG=${imageTag}`,
  ];
}

function isRailwayServiceConfigured(
  context: ReturnType<typeof resolveRailwayCommandContext>,
  serviceName: string,
): boolean {
  const variablesResult = context.runner({
    args: ["variables", "--service", serviceName, "--json"],
    cwd: context.cwd,
  });
  if ((variablesResult.status ?? 1) !== 0) {
    return false;
  }

  const variables = parseJsonRecord(variablesResult.stdout || "");
  if (!variables) {
    return false;
  }

  return REQUIRED_RAILWAY_VARIABLE_KEYS.every((key) => typeof variables[key] === "string" && variables[key]);
}

function configureRailwayService(
  context: ReturnType<typeof resolveRailwayCommandContext>,
  request: IndexerRequest,
  configContents: string,
  options: EnsureRailwayIndexerOptions,
) {
  // Torii state must survive redeploys; refuse to configure without a volume.
  if (!context.railwayEnvironmentId) {
    throw new Error(
      `Railway managed indexers require RAILWAY_ENVIRONMENT_ID to attach a persistent volume for "${request.worldName}"`,
    );
  }

  const volumeResult = context.runner({
    args: [
      "volume",
      "add",
      "--service",
      request.worldName,
      "--environment",
      context.railwayEnvironmentId,
      "--mount-path",
      resolveRailwayVolumeMountPath(options),
    ],
    cwd: context.cwd,
  });
  if (
    (volumeResult.status ?? 1) !== 0 &&
    !VOLUME_ALREADY_EXISTS_PATTERN.test(buildRailwayCommandOutput(volumeResult))
  ) {
    throw new Error(buildRailwayCommandFailureMessage(`add Railway volume for "${request.worldName}"`, volumeResult));
  }

  const variablesResult = context.runner({
    args: buildRailwayVariableArgs(request, configContents, options),
    cwd: context.cwd,
  });
  if ((variablesResult.status ?? 1) !== 0) {
    throw new Error(
      buildRailwayCommandFailureMessage(`set Railway variables for "${request.worldName}"`, variablesResult),
    );
  }

  const domainResult = context.runner({
    args: ["domain", "--service", request.worldName, "--json"],
    cwd: context.cwd,
  });
  if ((domainResult.status ?? 1) !== 0) {
    throw new Error(
      buildRailwayCommandFailureMessage(`provision Railway domain for "${request.worldName}"`, domainResult),
    );
  }

  const redeployResult = context.runner({
    args: ["redeploy", "--service", request.worldName, "--yes"],
    cwd: context.cwd,
  });
  if ((redeployResult.status ?? 1) !== 0) {
    throw new Error(buildRailwayCommandFailureMessage(`redeploy "${request.worldName}"`, redeployResult));
  }
}

export function ensureRailwayIndexerDeployment(
  request: IndexerRequest,
  options: EnsureRailwayIndexerOptions = {},
): RailwayIndexerActionResult {
  const requestedTier = request.tier || "basic";
  const preExistingState = resolveRailwayToriiLiveState(request.worldName, options);

  if (preExistingState.state === "indeterminate") {
    throw new Error(
      `Unable to verify whether Railway Torii deployment "${request.worldName}" already exists. Refusing to create a duplicate while state is indeterminate.`,
    );
  }

  const context = resolveRailwayCommandContext(options);

  // Service creation is multi-step on Railway, so an earlier run may have died
  // between `add` and full configuration. Only short-circuit when the service
  // is verifiably configured; otherwise reconcile it idempotently.
  if (
    preExistingState.state === "existing" &&
    preExistingState.url &&
    isRailwayServiceConfigured(context, request.worldName)
  ) {
    return {
      mode: "railway-cli",
      action: "already-live",
      liveState: preExistingState,
      requestedTier,
    };
  }

  const { configPath, configContents } = renderToriiConfigArtifact(
    request,
    path.join(RAILWAY_OUTPUT_DIRECTORY, request.env, request.worldName),
  );

  if (preExistingState.state === "missing") {
    const railwayToriiImage = requireRailwayToriiImage(options);
    const addResult = context.runner({
      args: ["add", "--service", request.worldName, "--image", railwayToriiImage],
      cwd: context.cwd,
    });
    if ((addResult.status ?? 1) !== 0) {
      throw new Error(buildRailwayCommandFailureMessage(`create Railway service "${request.worldName}"`, addResult));
    }
  } else {
    options.onProgress?.(`Railway Torii deployment ${request.worldName} exists but is not fully configured; repairing`);
  }

  configureRailwayService(context, request, configContents, options);

  const liveState = resolveRailwayToriiLiveState(request.worldName, options);
  return {
    mode: "railway-cli",
    action: preExistingState.state === "missing" ? "created" : "repaired",
    liveState,
    requestedTier,
    configPath,
  };
}

export function deleteRailwayIndexerDeployment(
  options: {
    name: string;
  } & Pick<
    EnsureRailwayIndexerOptions,
    | "onProgress"
    | "railwayCommandRunner"
    | "railwayWorkingDirectory"
    | "railwayApiToken"
    | "railwayWorkspaceId"
    | "railwayProjectId"
    | "railwayEnvironmentId"
  >,
): DeleteRailwayIndexerResult {
  const liveState = resolveRailwayToriiLiveState(options.name, options);

  if (liveState.state === "missing") {
    return {
      action: "already-missing",
      liveState,
    };
  }

  if (liveState.state === "indeterminate") {
    throw new Error(`Unable to verify the Railway Torii deployment state for "${options.name}"`);
  }

  const context = resolveRailwayCommandContext(options);
  const deleteResult = context.runner({
    args: ["down", "--service", options.name, "--yes"],
    cwd: context.cwd,
  });
  if ((deleteResult.status ?? 1) !== 0) {
    throw new Error(buildRailwayCommandFailureMessage(`delete Railway deployment "${options.name}"`, deleteResult));
  }

  return {
    action: "deleted",
    liveState: {
      state: "missing",
      stateSource: "describe-not-found",
      describedAt: new Date().toISOString(),
    },
  };
}

export function createRailwayManagedIndexerProvider(options: EnsureRailwayIndexerOptions = {}) {
  return {
    kind: "railway" as const,
    ensureDeployment: (request: IndexerRequest, operationOptions?: Pick<EnsureRailwayIndexerOptions, "onProgress">) =>
      ensureRailwayIndexerDeployment(request, { ...options, ...operationOptions }),
    resolveLiveState: (name: string, operationOptions?: Pick<EnsureRailwayIndexerOptions, "onProgress">) =>
      resolveRailwayToriiLiveState(name, { ...options, ...operationOptions }),
    resolveLiveStates: (gameNames: string[]) => resolveRailwayToriiLiveStates(gameNames, options),
    // Railway has no tier concept; omitting ensureTier makes tier operations
    // fail loudly instead of falsely reporting success.
    deleteDeployment: (deleteOptions: { name: string; onProgress?: (message: string) => void }) =>
      deleteRailwayIndexerDeployment({ ...deleteOptions, ...options }),
    listDeploymentNames: () => listRailwayToriiDeploymentNames(options),
  };
}
