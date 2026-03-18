import { DEFAULT_FACTORY_ACCOUNT_LEASE_DURATION_MS } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { createFactoryStoreEventMetadata } from "./context";
import {
  requireGitHubBranchStoreConfig,
  readGitHubBranchJsonFile,
  updateGitHubBranchJsonFile,
  type ResolveGitHubBranchStoreConfigOptions,
} from "./github";
import { resolveFactoryAccountLeasePath } from "./paths";
import { resolveLaunchStepTitle } from "./steps";
import type { FactoryAccountLeaseRecord, FactoryAccountLeaseRequestContext, FactoryRunWorkflowContext } from "./types";

interface RecordFactoryAccountLeaseOptions extends ResolveGitHubBranchStoreConfigOptions {}

interface FactoryAccountLeaseEventContext extends FactoryAccountLeaseRequestContext {
  chain: FactoryAccountLeaseRecord["chain"];
  launchRequestId: string;
  timestamp: string;
  workflow: FactoryRunWorkflowContext;
  leaseId: string;
}

export class FactoryAccountLeaseBusyError extends Error {
  constructor(readonly lease: FactoryAccountLeaseRecord) {
    super(buildBusyLeaseMessage(lease));
    this.name = "FactoryAccountLeaseBusyError";
  }
}

function buildBusyLeaseMessage(lease: FactoryAccountLeaseRecord): string {
  return [
    `Account ${lease.accountAddress} is already in use on ${lease.chain}.`,
    `Current owner: ${lease.owner.environment}/${lease.owner.gameName} during ${resolveLaunchStepTitle(lease.owner.stepId)}.`,
  ].join(" ");
}

function createAccountLeaseContext(request: FactoryAccountLeaseRequestContext): FactoryAccountLeaseEventContext {
  const environment = resolveDeploymentEnvironment(request.environmentId);
  const metadata = createFactoryStoreEventMetadata();

  return {
    ...request,
    ...metadata,
    chain: environment.chain,
    leaseId: request.leaseId || crypto.randomUUID(),
  };
}

function resolveFactoryAccountLeaseDurationMs(): number {
  const rawSeconds = process.env.FACTORY_ACCOUNT_LEASE_DURATION_SECONDS;
  if (!rawSeconds) {
    return DEFAULT_FACTORY_ACCOUNT_LEASE_DURATION_MS;
  }

  const parsedSeconds = Number(rawSeconds);
  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
    throw new Error(`FACTORY_ACCOUNT_LEASE_DURATION_SECONDS must be a positive number, received "${rawSeconds}"`);
  }

  return parsedSeconds * 1000;
}

function buildFactoryAccountLeaseRecord(context: FactoryAccountLeaseEventContext): FactoryAccountLeaseRecord {
  return {
    version: 1,
    chain: context.chain,
    accountAddress: context.accountAddress,
    owner: {
      environment: context.environmentId,
      gameName: context.gameName,
      launchRequestId: context.launchRequestId,
      workflowName: context.workflow.workflowName,
      workflowRunId: context.workflow.workflowRunId,
      workflowRunAttempt: context.workflow.workflowRunAttempt,
      stepId: context.stepId,
      leaseId: context.leaseId,
    },
    acquiredAt: context.timestamp,
    heartbeatAt: context.timestamp,
    expiresAt: new Date(Date.parse(context.timestamp) + resolveFactoryAccountLeaseDurationMs()).toISOString(),
  };
}

function isFactoryAccountLeaseReleased(record: FactoryAccountLeaseRecord): boolean {
  return Boolean(record.releasedAt);
}

function isFactoryAccountLeaseExpired(record: FactoryAccountLeaseRecord, timestamp: string): boolean {
  return Date.parse(record.expiresAt) <= Date.parse(timestamp);
}

function isFactoryAccountLeaseActive(record: FactoryAccountLeaseRecord, timestamp: string): boolean {
  return !isFactoryAccountLeaseReleased(record) && !isFactoryAccountLeaseExpired(record, timestamp);
}

function resolveReleasedAccountLease(record: FactoryAccountLeaseRecord, timestamp: string): FactoryAccountLeaseRecord {
  if (!isFactoryAccountLeaseActive(record, timestamp)) {
    return {
      ...record,
      releasedAt: record.releasedAt || timestamp,
      heartbeatAt: record.heartbeatAt || timestamp,
      expiresAt: timestamp,
    };
  }

  return record;
}

function ensureFactoryAccountLeaseAvailable(
  current: FactoryAccountLeaseRecord | undefined,
  context: FactoryAccountLeaseEventContext,
): void {
  if (!current) {
    return;
  }

  const normalizedCurrent = resolveReleasedAccountLease(current, context.timestamp);
  if (!isFactoryAccountLeaseActive(normalizedCurrent, context.timestamp)) {
    return;
  }

  if (normalizedCurrent.owner.leaseId === context.leaseId) {
    return;
  }

  throw new FactoryAccountLeaseBusyError(normalizedCurrent);
}

function refreshFactoryAccountLease(
  current: FactoryAccountLeaseRecord,
  context: FactoryAccountLeaseEventContext,
): FactoryAccountLeaseRecord {
  if (current.owner.leaseId !== context.leaseId) {
    return current;
  }

  return {
    ...current,
    heartbeatAt: context.timestamp,
    expiresAt: new Date(Date.parse(context.timestamp) + resolveFactoryAccountLeaseDurationMs()).toISOString(),
    releasedAt: undefined,
  };
}

function releaseFactoryAccountLease(
  current: FactoryAccountLeaseRecord,
  context: FactoryAccountLeaseEventContext,
): FactoryAccountLeaseRecord {
  if (current.owner.leaseId !== context.leaseId) {
    return current;
  }

  return {
    ...current,
    heartbeatAt: context.timestamp,
    expiresAt: context.timestamp,
    releasedAt: context.timestamp,
  };
}

function buildCommitMessage(action: string, context: FactoryAccountLeaseEventContext): string {
  return `factory-runs: ${action} account lease for ${context.environmentId}/${context.gameName}`;
}

export async function acquireFactoryAccountLease(
  request: FactoryAccountLeaseRequestContext,
  options: RecordFactoryAccountLeaseOptions = {},
): Promise<FactoryAccountLeaseRecord> {
  const context = createAccountLeaseContext(request);
  const config = requireGitHubBranchStoreConfig(options);
  const leasePath = resolveFactoryAccountLeasePath(context);

  return updateGitHubBranchJsonFile<FactoryAccountLeaseRecord>(
    config,
    leasePath,
    (current) => {
      ensureFactoryAccountLeaseAvailable(current, context);
      return buildFactoryAccountLeaseRecord(context);
    },
    buildCommitMessage("acquire", context),
  );
}

export async function heartbeatFactoryAccountLease(
  request: FactoryAccountLeaseRequestContext,
  options: RecordFactoryAccountLeaseOptions = {},
): Promise<FactoryAccountLeaseRecord | undefined> {
  const context = createAccountLeaseContext(request);
  const config = requireGitHubBranchStoreConfig(options);
  const leasePath = resolveFactoryAccountLeasePath(context);
  const currentLease = await readGitHubBranchJsonFile<FactoryAccountLeaseRecord>(config, leasePath);
  const existingLease = currentLease.value;

  if (!existingLease) {
    return undefined;
  }

  return updateGitHubBranchJsonFile<FactoryAccountLeaseRecord>(
    config,
    leasePath,
    (current) => refreshFactoryAccountLease(current || existingLease, context),
    buildCommitMessage("heartbeat", context),
  );
}

export async function releaseFactoryAccountLeaseRecord(
  request: FactoryAccountLeaseRequestContext,
  options: RecordFactoryAccountLeaseOptions = {},
): Promise<FactoryAccountLeaseRecord | undefined> {
  const context = createAccountLeaseContext(request);
  const config = requireGitHubBranchStoreConfig(options);
  const leasePath = resolveFactoryAccountLeasePath(context);
  const currentLease = await readGitHubBranchJsonFile<FactoryAccountLeaseRecord>(config, leasePath);
  const existingLease = currentLease.value;

  if (!existingLease) {
    return undefined;
  }

  return updateGitHubBranchJsonFile<FactoryAccountLeaseRecord>(
    config,
    leasePath,
    (current) => releaseFactoryAccountLease(current || existingLease, context),
    buildCommitMessage("release", context),
  );
}
