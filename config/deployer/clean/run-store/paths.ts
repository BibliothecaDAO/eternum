import * as path from "node:path";
import { resolveDeploymentEnvironment } from "../environment";
import { toSafeSlug } from "../shared/slug";
import type {
  FactoryAccountLeaseIdentity,
  FactoryMaintenanceIndexKind,
  FactoryRotationRunIdentity,
  FactoryRunIdentity,
  FactorySeriesRunIdentity,
} from "./types";

function resolveEnvironmentSegments(environmentId: FactoryRunIdentity["environmentId"]): string[] {
  const environment = resolveDeploymentEnvironment(environmentId);
  return [environment.chain, environment.gameType];
}

export function resolveFactoryRunId(identity: FactoryRunIdentity): string {
  return `${identity.environmentId}:${toSafeSlug(identity.gameName)}`;
}

export function resolveFactorySeriesRunId(identity: FactorySeriesRunIdentity): string {
  return `${identity.environmentId}:series:${toSafeSlug(identity.seriesName)}`;
}

export function resolveFactoryRotationRunId(identity: FactoryRotationRunIdentity): string {
  return `${identity.environmentId}:rotation:${toSafeSlug(identity.rotationName)}`;
}

export function resolveFactoryRunDirectoryPath(environmentId: FactoryRunIdentity["environmentId"]): string {
  return path.join("runs", ...resolveEnvironmentSegments(environmentId));
}

export function resolveFactorySeriesRunDirectoryPath(environmentId: FactorySeriesRunIdentity["environmentId"]): string {
  return path.join(resolveFactoryRunDirectoryPath(environmentId), "series");
}

export function resolveFactoryRotationRunDirectoryPath(
  environmentId: FactoryRotationRunIdentity["environmentId"],
): string {
  return path.join(resolveFactoryRunDirectoryPath(environmentId), "rotations");
}

function resolveFactoryMaintenanceIndexFileName(kind: FactoryMaintenanceIndexKind): string {
  switch (kind) {
    case "game":
      return "games.json";
    case "series":
      return "series.json";
    case "rotation":
      return "rotations.json";
  }
}

export function resolveFactoryMaintenanceIndexPath(
  environmentId: FactoryRunIdentity["environmentId"],
  kind: FactoryMaintenanceIndexKind,
): string {
  return path.join(
    "indexes",
    ...resolveEnvironmentSegments(environmentId),
    resolveFactoryMaintenanceIndexFileName(kind),
  );
}

export function resolveFactoryRunRecordPath(identity: FactoryRunIdentity): string {
  return path.join(resolveFactoryRunDirectoryPath(identity.environmentId), `${toSafeSlug(identity.gameName)}.json`);
}

export function resolveFactorySeriesRunRecordPath(identity: FactorySeriesRunIdentity): string {
  return path.join(
    resolveFactorySeriesRunDirectoryPath(identity.environmentId),
    `${toSafeSlug(identity.seriesName)}.json`,
  );
}

export function resolveFactoryRotationRunRecordPath(identity: FactoryRotationRunIdentity): string {
  return path.join(
    resolveFactoryRotationRunDirectoryPath(identity.environmentId),
    `${toSafeSlug(identity.rotationName)}.json`,
  );
}

export function resolveFactoryLaunchInputPath(identity: FactoryRunIdentity, launchRequestId: string): string {
  return path.join(
    "inputs",
    ...resolveEnvironmentSegments(identity.environmentId),
    toSafeSlug(identity.gameName),
    `${launchRequestId}.json`,
  );
}

export function resolveFactorySeriesLaunchInputPath(
  identity: FactorySeriesRunIdentity,
  launchRequestId: string,
): string {
  return path.join(
    "inputs",
    ...resolveEnvironmentSegments(identity.environmentId),
    "series",
    toSafeSlug(identity.seriesName),
    `${launchRequestId}.json`,
  );
}

export function resolveFactoryRotationLaunchInputPath(
  identity: FactoryRotationRunIdentity,
  launchRequestId: string,
): string {
  return path.join(
    "inputs",
    ...resolveEnvironmentSegments(identity.environmentId),
    "rotations",
    toSafeSlug(identity.rotationName),
    `${launchRequestId}.json`,
  );
}

export function resolveFactoryAccountLeasePath(identity: FactoryAccountLeaseIdentity): string {
  const environment = resolveDeploymentEnvironment(identity.environmentId);

  return path.join("locks", "accounts", environment.chain, `${toSafeSlug(identity.accountAddress)}.json`);
}
