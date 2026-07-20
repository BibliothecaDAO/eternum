import type { RuntimeEndpointRegistration } from "./runtime-registry-artifact";

export function buildLaunchRuntimeRegistrations(summaries: unknown[]): RuntimeEndpointRegistration[] {
  const registrations = new Map<string, RuntimeEndpointRegistration>();
  for (const summary of summaries) {
    const summaryRecord = asRecord(summary);
    if (summaryRecord) {
      collectLaunchSummaryRegistrations(summaryRecord, registrations);
    }
  }
  return [...registrations.values()];
}

function collectLaunchSummaryRegistrations(
  summary: Record<string, unknown>,
  registrations: Map<string, RuntimeEndpointRegistration>,
): void {
  const environmentId = asString(summary.environment);
  if (!environmentId) {
    return;
  }

  const gameName = asString(summary.gameName);
  if (gameName) {
    collectGameRuntimeRegistration(environmentId, gameName, summary, registrations);
  }

  if (!Array.isArray(summary.games)) {
    return;
  }
  for (const game of summary.games) {
    const gameSummary = asRecord(game);
    const groupedGameName = asString(gameSummary?.gameName);
    const artifacts = asRecord(gameSummary?.artifacts);
    if (groupedGameName && artifacts) {
      collectGameRuntimeRegistration(environmentId, groupedGameName, artifacts, registrations);
    }
  }
}

function collectGameRuntimeRegistration(
  environmentId: string,
  runtimeName: string,
  artifacts: Record<string, unknown>,
  registrations: Map<string, RuntimeEndpointRegistration>,
): void {
  const provider = artifacts.runtimeProvider;
  const awsRuntime = asRecord(artifacts.awsRuntime);
  if (provider === "aws" && awsRuntime) {
    addRuntimeRegistration(registrations, {
      scope: "game",
      provider,
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
