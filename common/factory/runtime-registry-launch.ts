import type { RuntimeEndpointRegistration } from "./runtime-registry-artifact";

export function buildLaunchRuntimeRegistrations(
  summaries: unknown[],
  options: { activateAws?: boolean } = {},
): RuntimeEndpointRegistration[] {
  const registrations = new Map<string, RuntimeEndpointRegistration>();
  for (const summary of summaries) {
    const summaryRecord = asRecord(summary);
    if (summaryRecord) {
      collectLaunchSummaryRegistrations(summaryRecord, Boolean(options.activateAws), registrations);
    }
  }
  return [...registrations.values()];
}

function collectLaunchSummaryRegistrations(
  summary: Record<string, unknown>,
  activateAws: boolean,
  registrations: Map<string, RuntimeEndpointRegistration>,
): void {
  const environmentId = asString(summary.environment);
  if (!environmentId) {
    return;
  }

  const gameName = asString(summary.gameName);
  if (gameName) {
    collectGameRuntimeRegistration(environmentId, gameName, summary, activateAws, registrations);
  }

  if (!Array.isArray(summary.games)) {
    return;
  }
  for (const game of summary.games) {
    const gameSummary = asRecord(game);
    const groupedGameName = asString(gameSummary?.gameName);
    const artifacts = asRecord(gameSummary?.artifacts);
    if (groupedGameName && artifacts) {
      collectGameRuntimeRegistration(environmentId, groupedGameName, artifacts, activateAws, registrations);
    }
  }
}

function collectGameRuntimeRegistration(
  environmentId: string,
  runtimeName: string,
  artifacts: Record<string, unknown>,
  activateAws: boolean,
  registrations: Map<string, RuntimeEndpointRegistration>,
): void {
  const provider = artifacts.runtimeProvider;
  if (provider === "slot" && typeof artifacts.indexerUrl === "string") {
    addRuntimeRegistration(registrations, {
      scope: "game",
      provider,
      activate: true,
      environmentId,
      runtimeKind: "torii",
      runtimeName,
      endpoints: buildToriiEndpoints(artifacts.indexerUrl),
    });
    return;
  }

  const awsRuntime = asRecord(artifacts.awsRuntime);
  if (provider === "aws" && awsRuntime) {
    addRuntimeRegistration(registrations, {
      scope: "game",
      provider,
      activate: activateAws,
      environmentId,
      runtimeKind: "torii",
      runtimeName,
      endpoints: asEndpointMap(awsRuntime.endpoints),
      runtimeInstanceId: asString(awsRuntime.runtimeInstanceId),
      imageDigest: asString(awsRuntime.imageDigest),
      routingShard: typeof awsRuntime.routingShard === "number" ? awsRuntime.routingShard : undefined,
    });
  }
}

function addRuntimeRegistration(
  registrations: Map<string, RuntimeEndpointRegistration>,
  registration: RuntimeEndpointRegistration,
): void {
  registrations.set(
    `${registration.provider}:${registration.environmentId}:${registration.runtimeKind}:${registration.runtimeName}`,
    registration,
  );
}

function buildToriiEndpoints(endpointUrl: string): RuntimeEndpointRegistration["endpoints"] {
  const base = endpointUrl.replace(/\/+$/, "");
  return {
    base,
    health: `${base}/health`,
    sql: `${base}/sql`,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asEndpointMap(value: unknown): RuntimeEndpointRegistration["endpoints"] {
  const record = asRecord(value);
  return record
    ? Object.fromEntries(
        Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      )
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
