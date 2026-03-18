import * as path from "node:path";
import { resolveDeploymentEnvironment } from "../environment";
import { toSafeSlug } from "../shared/slug";
import type { FactoryAccountLeaseIdentity, FactoryRunIdentity } from "./types";

function resolveEnvironmentSegments(environmentId: FactoryRunIdentity["environmentId"]): string[] {
  const environment = resolveDeploymentEnvironment(environmentId);
  return [environment.chain, environment.gameType];
}

export function resolveFactoryRunId(identity: FactoryRunIdentity): string {
  return `${identity.environmentId}:${toSafeSlug(identity.gameName)}`;
}

export function resolveFactoryRunRecordPath(identity: FactoryRunIdentity): string {
  return path.join(
    "runs",
    ...resolveEnvironmentSegments(identity.environmentId),
    `${toSafeSlug(identity.gameName)}.json`,
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

export function resolveFactoryAccountLeasePath(identity: FactoryAccountLeaseIdentity): string {
  const environment = resolveDeploymentEnvironment(identity.environmentId);

  return path.join("locks", "accounts", environment.chain, `${toSafeSlug(identity.accountAddress)}.json`);
}
