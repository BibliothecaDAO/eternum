#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const MAX_REGIONAL_RTO_SECONDS = 2 * 60 * 60;
const CHECKPOINT_CONTAINER_NAME = "runtime-checkpoint";

async function main() {
  const startedAt = new Date().toISOString();
  try {
    const request = readRequest(process.argv.slice(2));
    const recoveryPlan = shouldResolveRegistry(request.operation)
      ? await resolveRegistryRecoveryRuntimes(request.manifest)
      : undefined;
    const imagePreflight = shouldPreflightImages(request.operation)
      ? preflightRecoveryImages(recoveryPlan.runtimes)
      : undefined;
    const runtimeResults = shouldDeployRuntimes(request.operation)
      ? recoveryPlan.runtimes.map(deployRuntime)
      : undefined;
    const route53Result = shouldUpdateRoute53(request.operation)
      ? updateRoute53(request.manifest, recoveryPlan.routeHosts)
      : undefined;
    const rtoSeconds = shouldMeasureRto(request.operation) ? requireRegionalRto(request.manifest) : undefined;
    printJson({
      schemaVersion: 1,
      operation: "aws-runtime-dr-recovery",
      status: "passed",
      recoveryOperation: request.operation,
      environmentId: request.manifest.environmentId,
      startedAt,
      finishedAt: new Date().toISOString(),
      runtimeResults,
      imagePreflight,
      route53Result,
      rtoSeconds,
    });
  } catch (error) {
    printJson({
      schemaVersion: 1,
      operation: "aws-runtime-dr-recovery",
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

async function resolveRegistryRecoveryRuntimes(manifest) {
  const registry = await readRuntimeRegistry();
  const aliasPrefixes = requireRegistryAliasPrefixes(manifest);
  const selectedAliases = selectRecoveryAliases(registry, aliasPrefixes);
  const registryRuntimes = groupRecoveryAliasesByRuntime(selectedAliases, manifest.environmentId);
  const manifestRuntimeIds = new Set(manifest.runtimes.map((runtime) => runtime.runtimeInstanceId));
  const runtimes = manifest.runtimes.map((runtime) => {
    const registryRuntime = registryRuntimes.get(runtime.runtimeInstanceId);
    if (!registryRuntime) {
      throw new Error(`DR recovery runtime ${runtime.runtimeName || runtime.runtimeInstanceId} is not in the registry`);
    }
    if (registryRuntime.runtimeName !== runtime.runtimeName) {
      throw new Error(`DR recovery runtime ${runtime.runtimeInstanceId} name does not match the registry`);
    }
    if (runtime.environmentId && runtime.environmentId !== manifest.environmentId) {
      throw new Error(`DR recovery runtime ${runtime.runtimeInstanceId} environment does not match the manifest`);
    }
    return {
      ...runtime,
      environmentId: manifest.environmentId,
      imageDigest: registryRuntime.imageDigest,
      routingShard: registryRuntime.routingShard,
    };
  });
  for (const runtimeInstanceId of registryRuntimes.keys()) {
    if (!manifestRuntimeIds.has(runtimeInstanceId)) {
      throw new Error(`DR recovery manifest is missing registry runtime ${runtimeInstanceId}`);
    }
  }
  return {
    runtimes,
    routeHosts: [...new Set([...registryRuntimes.values()].map((runtime) => runtime.routeHost))].sort(),
  };
}

async function readRuntimeRegistry() {
  const registryUrl = process.env.RUNTIME_REGISTRY_URL?.trim();
  if (!registryUrl) {
    throw new Error("RUNTIME_REGISTRY_URL is required for DR service recovery");
  }
  const response = await fetch(registryUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Runtime registry read failed: ${response.status} ${response.statusText}`);
  }
  const registry = await response.json();
  if (
    registry?.schemaVersion !== "realms-runtime-registry/v1" ||
    !Number.isInteger(registry.revision) ||
    !registry.aliases ||
    typeof registry.aliases !== "object" ||
    Array.isArray(registry.aliases)
  ) {
    throw new Error("Runtime registry response is invalid");
  }
  return registry;
}

function requireRegistryAliasPrefixes(manifest) {
  if (
    !Array.isArray(manifest.registryAliasPrefixes) ||
    manifest.registryAliasPrefixes.length === 0 ||
    manifest.registryAliasPrefixes.some((prefix) => typeof prefix !== "string" || !/^[a-z0-9.-]+$/.test(prefix))
  ) {
    throw new Error("DR recovery manifest requires canonical registryAliasPrefixes");
  }
  return manifest.registryAliasPrefixes;
}

function selectRecoveryAliases(registry, aliasPrefixes) {
  for (const prefix of aliasPrefixes) {
    if (!Object.keys(registry.aliases).some((alias) => alias.startsWith(prefix))) {
      throw new Error(`DR recovery registry prefix ${prefix} did not match any aliases`);
    }
  }
  return Object.entries(registry.aliases).filter(
    ([alias, entry]) => aliasPrefixes.some((prefix) => alias.startsWith(prefix)) && entry?.providers?.aws,
  );
}

function groupRecoveryAliasesByRuntime(selectedAliases, environmentId) {
  const runtimes = new Map();
  for (const [alias, entry] of selectedAliases) {
    validateRecoveryAlias(alias, entry, environmentId);
    const current = runtimes.get(entry.runtimeInstanceId) || {
      runtimeName: entry.runtimeName,
      imageDigest: entry.imageDigest,
      routingShard: entry.routingShard,
      routeHost: resolveRecoveryRouteHost(alias, entry, environmentId),
      endpointKinds: new Set(),
    };
    if (
      current.runtimeName !== entry.runtimeName ||
      current.imageDigest !== entry.imageDigest ||
      current.routingShard !== entry.routingShard ||
      current.routeHost !== resolveRecoveryRouteHost(alias, entry, environmentId)
    ) {
      throw new Error(`DR recovery registry metadata is inconsistent for ${entry.runtimeInstanceId}`);
    }
    current.endpointKinds.add(entry.endpointKind);
    runtimes.set(entry.runtimeInstanceId, current);
  }

  for (const [runtimeInstanceId, runtime] of runtimes) {
    for (const endpointKind of ["base", "health", "sql"]) {
      if (!runtime.endpointKinds.has(endpointKind)) {
        throw new Error(`DR recovery registry runtime ${runtimeInstanceId} is missing ${endpointKind}`);
      }
    }
  }
  return runtimes;
}

function resolveRecoveryRouteHost(alias, entry, environmentId) {
  let endpoint;
  try {
    endpoint = new URL(entry.providers.aws);
  } catch {
    throw new Error(`DR recovery registry alias ${alias} has an invalid AWS endpoint`);
  }
  const expectedHost = `s${entry.routingShard}.${environmentId.replaceAll(".", "-")}.${resolveRuntimeDomain()}`;
  if (endpoint.protocol !== "https:" || endpoint.hostname !== expectedHost) {
    throw new Error(`DR recovery registry alias ${alias} has an invalid route host`);
  }
  return endpoint.hostname;
}

function resolveRuntimeDomain() {
  const domain = normalizeDnsName(process.env.AWS_RUNTIME_DOMAIN || "runtime.realms.world");
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) || !domain.includes(".")) {
    throw new Error("AWS_RUNTIME_DOMAIN must be a valid DNS suffix");
  }
  return domain;
}

function validateRecoveryAlias(alias, entry, environmentId) {
  if (
    entry.environmentId !== environmentId ||
    entry.runtimeKind !== "torii" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(entry.runtimeName || "") ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(entry.runtimeInstanceId || "") ||
    !/^sha256:[a-f0-9]{64}$/.test(entry.imageDigest || "") ||
    !Number.isInteger(entry.routingShard) ||
    entry.routingShard < 0
  ) {
    throw new Error(`DR recovery registry alias ${alias} has invalid immutable metadata`);
  }
}

function requireRegionalRto(manifest) {
  const recoveryStartedAtMs = Date.parse(manifest.recoveryStartedAt || "");
  if (!Number.isFinite(recoveryStartedAtMs)) {
    throw new Error("DR recovery manifest requires recoveryStartedAt for measured RTO");
  }
  const rtoSeconds = Math.max(0, Math.floor((Date.now() - recoveryStartedAtMs) / 1000));
  if (rtoSeconds > MAX_REGIONAL_RTO_SECONDS) {
    throw new Error(`Regional recovery RTO ${rtoSeconds}s exceeds ${MAX_REGIONAL_RTO_SECONDS}s`);
  }
  return rtoSeconds;
}

function readRequest(argv) {
  const fileIndex = argv.indexOf("--manifest-file");
  const filePath = fileIndex >= 0 ? argv[fileIndex + 1] : undefined;
  if (!filePath) {
    throw new Error("DR recovery requires --manifest-file");
  }
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (
    manifest.schemaVersion !== 1 ||
    !/^mainnet\.(blitz|eternum)$/.test(manifest.environmentId || "") ||
    !Array.isArray(manifest.runtimes) ||
    manifest.runtimes.length === 0
  ) {
    throw new Error("DR recovery manifest is invalid");
  }
  if (manifest.runtimes.some((runtime) => runtime.runtimeKind !== "torii")) {
    throw new Error("Mainnet DR recovery permits Torii runtimes only");
  }
  const operationIndex = argv.indexOf("--operation");
  const operation = operationIndex >= 0 ? argv[operationIndex + 1] : undefined;
  if (!new Set(["deploy", "preflight", "route53", "measure"]).has(operation)) {
    throw new Error("DR recovery --operation must be deploy, preflight, route53, or measure");
  }
  return { manifest, operation };
}

function shouldDeployRuntimes(operation) {
  return operation === "deploy";
}

function shouldResolveRegistry(operation) {
  return shouldDeployRuntimes(operation) || shouldPreflightImages(operation) || shouldUpdateRoute53(operation);
}

function shouldPreflightImages(operation) {
  return operation === "preflight";
}

function shouldUpdateRoute53(operation) {
  return operation === "route53";
}

function shouldMeasureRto(operation) {
  return operation === "measure";
}

function deployRuntime(runtime) {
  const args = [
    "config/deployer/clean/cli/aws-runtime.ts",
    "--operation",
    "deploy",
    "--environment",
    runtime.environmentId,
    "--runtime-kind",
    runtime.runtimeKind,
    "--runtime-name",
    runtime.runtimeName,
    "--runtime-instance-id",
    runtime.runtimeInstanceId,
    "--image-digest",
    runtime.imageDigest,
    "--lifecycle-class",
    runtime.lifecycleClass || "ephemeral",
  ];
  appendArg(args, "--tier", runtime.tier);
  appendArg(args, "--world-address", runtime.worldAddress);
  appendArg(args, "--world-block", runtime.worldBlock);
  appendArg(args, "--namespaces", runtime.namespaces);
  appendArg(
    args,
    "--upstream-rpc-secret-arn",
    process.env.AWS_RUNTIME_UPSTREAM_RPC_SECRET_ARN || runtime.upstreamRpcSecretArn,
  );
  appendArg(args, "--routing-shard", runtime.routingShard === undefined ? undefined : `${runtime.routingShard}`);

  const result = spawnSync("bun", args, { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`DR runtime deployment failed for ${runtime.runtimeName}: ${result.stderr || result.stdout}`);
  }
  const deployment = JSON.parse(result.stdout);
  const recoveryHealth = verifyRecoveredRuntime(deployment);
  return { ...deployment, recoveryHealth };
}

function preflightRecoveryImages(runtimes) {
  const repositoryUrl = requireEnvironment("AWS_RUNTIME_ECR_REPOSITORY_URL");
  const repositoryName = repositoryUrl.split("/").slice(1).join("/");
  if (!repositoryName) {
    throw new Error("AWS_RUNTIME_ECR_REPOSITORY_URL must include a repository name");
  }

  const imageDigests = [...new Set(runtimes.map((runtime) => runtime.imageDigest))].sort();
  for (const imageDigest of imageDigests) {
    const result = runAws(`verify replicated runtime image ${imageDigest}`, [
      "ecr",
      "describe-images",
      "--region",
      resolveAwsRegion(),
      "--repository-name",
      repositoryName,
      "--image-ids",
      `imageDigest=${imageDigest}`,
      "--output",
      "json",
    ]);
    const replicatedDigest = JSON.parse(result.stdout || "{}").imageDetails?.[0]?.imageDigest;
    if (replicatedDigest !== imageDigest) {
      throw new Error(`DR ECR repository is missing replicated runtime image ${imageDigest}`);
    }
  }

  return { repositoryUrl, imageDigests, checkedAt: new Date().toISOString() };
}

function verifyRecoveredRuntime(deployment) {
  const liveState = deployment.liveState || {};
  const targetGroupArn = liveState.targetGroupArn;
  const serviceName = liveState.serviceName;
  if (!targetGroupArn || !serviceName) {
    throw new Error("DR runtime deployment result is missing target group or service metadata");
  }

  runAws("wait for recovered ALB targets", [
    "elbv2",
    "wait",
    "target-in-service",
    "--region",
    resolveAwsRegion(),
    "--target-group-arn",
    targetGroupArn,
  ]);
  const taskArn = resolveRecoveredTaskArn(serviceName);
  const marker = "recovery-health-ok";
  const health = runAws("probe recovered runtime from checkpoint sidecar", [
    "ecs",
    "execute-command",
    "--region",
    resolveAwsRegion(),
    "--cluster",
    requireEnvironment("AWS_RUNTIME_CLUSTER"),
    "--task",
    taskArn,
    "--container",
    CHECKPOINT_CONTAINER_NAME,
    "--interactive",
    "--command",
    `sh -c 'curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8080/health >/dev/null && printf ${marker}'`,
  ]);
  if (!`${health.stdout || ""}${health.stderr || ""}`.includes(marker)) {
    throw new Error(`Recovered runtime ${serviceName} did not pass its destination-local semantic health probe`);
  }

  return { targetGroupArn, taskArn, checkedAt: new Date().toISOString() };
}

function resolveRecoveredTaskArn(serviceName) {
  const result = runAws("resolve recovered runtime task", [
    "ecs",
    "list-tasks",
    "--region",
    resolveAwsRegion(),
    "--cluster",
    requireEnvironment("AWS_RUNTIME_CLUSTER"),
    "--service-name",
    serviceName,
    "--desired-status",
    "RUNNING",
    "--output",
    "json",
  ]);
  const taskArn = JSON.parse(result.stdout || "{}").taskArns?.[0];
  if (!taskArn) {
    throw new Error(`Recovered runtime ${serviceName} has no running task`);
  }
  return taskArn;
}

function runAws(action, args) {
  const result = spawnSync("aws", args, { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Failed to ${action}: ${result.stderr || result.stdout || `aws exited with ${result.status}`}`);
  }
  return result;
}

function resolveAwsRegion() {
  return process.env.AWS_REGION || "us-west-2";
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for DR recovery`);
  }
  return value;
}

function updateRoute53(manifest, routeHosts) {
  if (!manifest.hostedZoneId || !manifest.route53ChangeBatch) {
    throw new Error("DR recovery manifest requires hostedZoneId and route53ChangeBatch");
  }
  validateRoute53ChangeBatch(manifest.route53ChangeBatch, resolveDrAlbTargets(routeHosts));
  const result = spawnSync(
    "aws",
    [
      "route53",
      "change-resource-record-sets",
      "--hosted-zone-id",
      manifest.hostedZoneId,
      "--change-batch",
      JSON.stringify(manifest.route53ChangeBatch),
      "--output",
      "json",
    ],
    { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 },
  );
  if ((result.status ?? 1) !== 0) {
    throw new Error(`DR Route53 failover update failed: ${result.stderr || result.stdout}`);
  }
  const change = JSON.parse(result.stdout);
  const changeId = change.ChangeInfo?.Id;
  if (!changeId) {
    throw new Error("DR Route53 failover update did not return a change ID");
  }

  const waiter = spawnSync("aws", ["route53", "wait", "resource-record-sets-changed", "--id", changeId], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if ((waiter.status ?? 1) !== 0) {
    throw new Error(`DR Route53 failover did not reach INSYNC: ${waiter.stderr || waiter.stdout}`);
  }
  return { ...change, insyncAt: new Date().toISOString() };
}

function validateRoute53ChangeBatch(changeBatch, expectedTargets) {
  const changes = changeBatch?.Changes;
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error("DR Route53 failover requires at least one alias UPSERT");
  }

  const expectedHosts = new Set(expectedTargets.keys());
  const changedHosts = new Set();
  for (const change of changes) {
    const record = change?.ResourceRecordSet;
    const host = normalizeDnsName(record?.Name);
    const aliasTarget = record?.AliasTarget;
    const expectedTarget = expectedTargets.get(host);
    if (
      change?.Action !== "UPSERT" ||
      record?.Type !== "A" ||
      !expectedTarget ||
      !aliasTarget ||
      aliasTarget.EvaluateTargetHealth !== true ||
      aliasTarget.HostedZoneId !== expectedTarget.hostedZoneId ||
      stripDualstackPrefix(normalizeDnsName(aliasTarget.DNSName)) !== stripDualstackPrefix(expectedTarget.dnsName)
    ) {
      throw new Error(`DR Route53 failover contains an invalid change for ${host || "unknown host"}`);
    }
    if (changedHosts.has(host)) {
      throw new Error(`DR Route53 failover contains duplicate changes for ${host}`);
    }
    changedHosts.add(host);
  }

  if (changedHosts.size !== expectedHosts.size || [...expectedHosts].some((host) => !changedHosts.has(host))) {
    throw new Error("DR Route53 failover must update every recovered shard host exactly once");
  }
}

function resolveDrAlbTargets(routeHosts) {
  const dnsNames = readRequiredStringArrayEnvironment("AWS_DR_RUNTIME_ALB_DNS_NAMES");
  const hostedZoneIds = readRequiredStringArrayEnvironment("AWS_DR_RUNTIME_ALB_HOSTED_ZONE_IDS");
  if (dnsNames.length !== hostedZoneIds.length) {
    throw new Error("DR ALB DNS names and hosted zone IDs must have the same shard count");
  }

  return new Map(
    routeHosts.map((routeHost) => {
      const shard = Number(/^s(?<shard>[0-9]+)\./.exec(routeHost)?.groups?.shard);
      const dnsName = normalizeDnsName(dnsNames[shard]);
      const hostedZoneId = hostedZoneIds[shard];
      if (
        !Number.isInteger(shard) ||
        !dnsName.endsWith(".elb.amazonaws.com") ||
        !/^Z[A-Z0-9]+$/.test(hostedZoneId || "")
      ) {
        throw new Error(`DR ALB target configuration is missing routing shard ${routeHost}`);
      }
      return [routeHost, { dnsName, hostedZoneId }];
    }),
  );
}

function readRequiredStringArrayEnvironment(name) {
  let value;
  try {
    value = JSON.parse(requireEnvironment(name));
  } catch (error) {
    throw new Error(`${name} must be a JSON string array: ${error instanceof Error ? error.message : error}`);
  }
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || !entry)) {
    throw new Error(`${name} must be a non-empty JSON string array`);
  }
  return value;
}

function stripDualstackPrefix(value) {
  return value.startsWith("dualstack.") ? value.slice("dualstack.".length) : value;
}

function normalizeDnsName(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\.$/, "") : "";
}

function appendArg(args, flag, value) {
  if (value !== undefined && value !== null && `${value}` !== "") {
    args.push(flag, `${value}`);
  }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

await main();
