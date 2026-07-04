import {
  buildAwsCommandOutput,
  buildAwsCommandFailureMessage,
  commandOutputText,
  isMissingAwsCleanupOutput,
  parseJsonOutput,
  runOptionalAwsCleanupCommand,
  runRequiredAwsCommand,
  type AwsCommandRunner,
} from "./commands";
import { buildAwsRuntimeTags, readTag, toAwsTagList, type AwsRuntimeCommandConfig } from "./config";
import { buildRuntimeRootPath, type AwsRuntimeNamingRequest } from "./naming";

export interface AwsRuntimeResourceRequest extends AwsRuntimeNamingRequest {
  runtimeName: string;
}

export function ensureEfsAccessPoint(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeResourceRequest,
  config: AwsRuntimeCommandConfig,
): { efsAccessPointId: string; adopted: boolean } {
  const efsAccessPointId = resolveEfsAccessPointIdByRootPath(commandRunner, request, config);

  if (efsAccessPointId) {
    return { efsAccessPointId, adopted: true };
  }

  return { efsAccessPointId: createEfsAccessPoint(commandRunner, request, config), adopted: false };
}

export function resolveEfsAccessPointIdByRootPath(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeResourceRequest,
  config: AwsRuntimeCommandConfig,
): string | undefined {
  const result = commandRunner([
    "efs",
    "describe-access-points",
    "--region",
    config.region,
    "--file-system-id",
    config.efsFileSystemId,
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (isMissingAwsCleanupOutput(output)) {
      return undefined;
    }

    throw new Error(buildAwsCommandFailureMessage(`describe EFS access points for "${request.runtimeName}"`, result));
  }

  const payload = parseJsonOutput<{ AccessPoints?: Array<Record<string, unknown>> }>(result.stdout || "", {});
  const accessPoint = (payload.AccessPoints || []).find((candidate) => {
    const rootDirectory = candidate.RootDirectory as Record<string, unknown> | undefined;
    return rootDirectory?.Path === buildRuntimeRootPath(request) && accessPointBelongsToRuntime(candidate, request);
  });
  const accessPointId = accessPoint?.AccessPointId;
  return typeof accessPointId === "string" && accessPointId ? accessPointId : undefined;
}

export function deleteEfsAccessPointIfPresent(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeResourceRequest,
  config: AwsRuntimeCommandConfig,
  efsAccessPointId?: string,
): boolean {
  if (!efsAccessPointId) {
    return false;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete EFS access point for "${request.runtimeName}"`, [
    "efs",
    "delete-access-point",
    "--region",
    config.region,
    "--access-point-id",
    efsAccessPointId,
  ]);
  return true;
}

function createEfsAccessPoint(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeResourceRequest,
  config: AwsRuntimeCommandConfig,
): string {
  const result = runRequiredAwsCommand(commandRunner, `create EFS access point for "${request.runtimeName}"`, [
    "efs",
    "create-access-point",
    "--region",
    config.region,
    "--file-system-id",
    config.efsFileSystemId,
    "--posix-user",
    "Uid=1000,Gid=1000",
    "--root-directory",
    `Path=${buildRuntimeRootPath(request)},CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=750}`,
    "--tags",
    ...toAwsTagList(buildAwsRuntimeTags(request)),
    "--query",
    "AccessPointId",
    "--output",
    "text",
  ]);

  return commandOutputText(result);
}

function accessPointBelongsToRuntime(
  accessPoint: Record<string, unknown>,
  request: AwsRuntimeResourceRequest,
): boolean {
  const tags = accessPoint.Tags;
  return buildStableRuntimeIdentityTags(request).every(({ key, value }) => readTag(tags, key) === value);
}

function buildStableRuntimeIdentityTags(request: AwsRuntimeResourceRequest): Array<{ key: string; value: string }> {
  const stableKeys = new Set(["Project", "Environment", "RuntimeKind", "RuntimeName", "RuntimeServiceName"]);
  return buildAwsRuntimeTags(request).filter((tag) => stableKeys.has(tag.key));
}
