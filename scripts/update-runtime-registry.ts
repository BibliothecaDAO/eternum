#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildLaunchRuntimeRegistrations } from "../common/factory/runtime-registry-launch";
import {
  removeRuntimeArtifact,
  removeRuntimeArtifacts,
  registerRuntimeArtifact,
  registerRuntimeEndpointRegistrations,
  switchRuntimeAliasProvider,
  type RegistryRuntimeArtifact,
} from "../common/factory/runtime-registry-artifact";
import {
  getDefaultRuntimeRegistry,
  parseRuntimeRegistry,
  type RuntimeAliasScope,
  type RuntimeRegistryProvider,
} from "../common/factory/runtime-registry";
import { requireRuntimeInstanceId } from "../config/deployer/clean/runtime/runtime-identity";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const registryUrl = requireValue(args, "registry-url", process.env.RUNTIME_REGISTRY_URL);
  const adminSecret = requireValue(args, "admin-secret", process.env.FACTORY_WORKER_ADMIN_SECRET);
  const publishedRegistry = await publishRegistryUpdate(args, registryUrl, adminSecret);
  process.stdout.write(`${JSON.stringify(publishedRegistry, null, 2)}\n`);
}

async function publishRegistryUpdate(
  args: Record<string, string>,
  registryUrl: string,
  adminSecret: string,
): Promise<unknown> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const registry = await readRegistryIfPresent(registryUrl);
    rejectExistingRegistrySeed(args, registry);
    const nextRegistry = buildNextRegistry(args, registry || requireSeedOperation(args));
    if (nextRegistry === registry) {
      return registry;
    }
    const response = await publishRegistry(registryUrl, adminSecret, nextRegistry, registry?.revision || 0);
    if (response.status !== 409) {
      if (!response.ok) {
        throw new Error(`Runtime registry publish failed: ${response.status} ${await response.text()}`);
      }
      return response.json();
    }

    if (attempt === maxAttempts) {
      throw new Error(`Runtime registry publish conflicted ${maxAttempts} times`);
    }
    await response.text();
    await delay(100 * 2 ** (attempt - 1));
  }

  throw new Error("Runtime registry publish retry loop exited unexpectedly");
}

export function buildNextRegistry(
  args: Record<string, string>,
  currentRegistry: ReturnType<typeof parseRuntimeRegistry>,
) {
  if (args["seed-default"] === "true") {
    return getDefaultRuntimeRegistry();
  }
  if (args["teardown-result-file"]) {
    const teardownResult = JSON.parse(fs.readFileSync(args["teardown-result-file"], "utf8")) as unknown;
    return applyRuntimeTeardownResult(currentRegistry, teardownResult);
  }
  if (args["remove-runtime-instance-id"]) {
    return removeRuntimeArtifact(currentRegistry, args["remove-runtime-instance-id"]);
  }
  if (args["maintenance-result-file"]) {
    return removeRuntimeArtifacts(currentRegistry, readMaintenanceRuntimeInstanceIds(args["maintenance-result-file"]));
  }
  if (args["alias-prefix"]) {
    return switchRuntimeAliasProvider(currentRegistry, args["alias-prefix"], requireProvider(args.provider));
  }
  if (args["launch-summary-directory"]) {
    return registerRuntimeEndpointRegistrations(
      currentRegistry,
      readLaunchRuntimeRegistrations(args["launch-summary-directory"], args["activate-aws"] === "true"),
    );
  }
  return registerRuntimeArtifact(currentRegistry, readArtifact(requireValue(args, "artifact-file")), {
    scope: requireScope(args.scope),
    provider: requireProvider(args.provider || "aws"),
    activate: args.activate === "true",
    fallbackEndpoints: resolveFallbackEndpoints(args),
  });
}

interface RuntimeTeardownRegistryResult {
  remove: boolean;
  runtimeInstanceId: string;
}

export function applyRuntimeTeardownResult(
  currentRegistry: ReturnType<typeof parseRuntimeRegistry>,
  value: unknown,
): ReturnType<typeof parseRuntimeRegistry> {
  const teardown = parseRuntimeTeardownResult(value);
  return teardown.remove ? removeRuntimeArtifact(currentRegistry, teardown.runtimeInstanceId) : currentRegistry;
}

function parseRuntimeTeardownResult(value: unknown): RuntimeTeardownRegistryResult {
  const record = asJsonRecord(value);
  if (!record || record.operation !== "delete") {
    throw new Error("Runtime teardown result must describe a delete operation");
  }

  const action = record.action;
  if (action !== "deleted" && action !== "already-missing" && action !== "skipped-stale") {
    throw new Error(`Runtime teardown result has unsupported action "${String(action || "")}"`);
  }

  return {
    remove: action === "deleted" || action === "already-missing",
    runtimeInstanceId: requireRuntimeInstanceId(
      typeof record.runtimeInstanceId === "string" ? record.runtimeInstanceId : undefined,
    ),
  };
}

async function publishRegistry(
  registryUrl: string,
  adminSecret: string,
  nextRegistry: ReturnType<typeof parseRuntimeRegistry>,
  expectedRevision: number,
): Promise<Response> {
  return fetch(registryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-factory-admin-secret": adminSecret,
    },
    body: JSON.stringify({ registry: nextRegistry, expectedRevision }),
  });
}

function rejectExistingRegistrySeed(
  args: Record<string, string>,
  registry: ReturnType<typeof parseRuntimeRegistry> | undefined,
): void {
  if (args["seed-default"] === "true" && registry) {
    throw new Error("Runtime registry is already published; seed-default cannot overwrite an existing revision");
  }
}

async function readRegistryIfPresent(url: string) {
  const uncachedRequest = {
    cache: "no-store" as const,
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  };
  const response = await fetch(url, uncachedRequest);
  if (response.status === 503) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Runtime registry read failed: ${response.status} ${response.statusText}`);
  }
  return parseRuntimeRegistry(await response.json());
}

function requireSeedOperation(args: Record<string, string>) {
  if (args["seed-default"] === "true") {
    return getDefaultRuntimeRegistry();
  }
  throw new Error("Runtime registry is not published; run with --seed-default true first");
}

function readArtifact(filePath: string): RegistryRuntimeArtifact {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Runtime registry artifact file ${filePath} must contain a JSON object`);
  }
  const record = value as RegistryRuntimeArtifact & { artifact?: RegistryRuntimeArtifact };
  return record.artifact || record;
}

function resolveFallbackEndpoints(args: Record<string, string>) {
  if (args["fallback-endpoints-json"]) {
    const value = JSON.parse(args["fallback-endpoints-json"]) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Runtime registry fallback endpoints must be a JSON object");
    }
    return value as RegistryRuntimeArtifact["endpoints"];
  }
  return args["fallback-artifact-file"] ? readArtifact(args["fallback-artifact-file"]).endpoints : undefined;
}

function readLaunchRuntimeRegistrations(directory: string, activateAws: boolean) {
  const summaries = fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((filename) => JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8")) as unknown);
  const registrations = buildLaunchRuntimeRegistrations(summaries, { activateAws });
  if (registrations.length === 0) {
    throw new Error(`No published runtime endpoints found in launch summaries under ${directory}`);
  }
  return registrations;
}

function readMaintenanceRuntimeInstanceIds(filePath: string): string[] {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Indexer maintenance result must be a JSON object");
  }
  const record = value as { schemaVersion?: unknown; results?: unknown };
  if (record.schemaVersion !== 1 || !Array.isArray(record.results)) {
    throw new Error("Indexer maintenance result must use schemaVersion 1 and contain results");
  }

  return [
    ...new Set(
      record.results.flatMap((result) => {
        const resultRecord = asJsonRecord(result);
        const ids = resultRecord?.runtimeInstanceIds;
        return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
      }),
    ),
  ];
}

function asJsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(`Invalid runtime registry argument near "${name || ""}"`);
    }
    args[name.slice(2)] = value;
  }
  return args;
}

function requireValue(args: Record<string, string>, name: string, fallback?: string): string {
  const value = args[name] || fallback;
  if (!value) {
    throw new Error(`Runtime registry update requires --${name}`);
  }
  return value;
}

function requireProvider(value?: string): RuntimeRegistryProvider {
  if (value === "slot" || value === "aws") {
    return value;
  }
  throw new Error("Runtime registry provider must be slot or aws");
}

function requireScope(value?: string): RuntimeAliasScope {
  if (value === "factory" || value === "global" || value === "shared-chain" || value === "game") {
    return value;
  }
  throw new Error("Runtime registry scope must be factory, global, shared-chain, or game");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
