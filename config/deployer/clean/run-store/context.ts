import { DEFAULT_GAME_LAUNCH_WORKFLOW_FILE } from "../constants";
import {
  resolveFactoryLaunchInputPath,
  resolveFactoryRotationLaunchInputPath,
  resolveFactorySeriesLaunchInputPath,
} from "./paths";
import type {
  FactoryRotationRunRequestContext,
  FactoryRotationRunStoreEventContext,
  FactoryRunRequestContext,
  FactoryRunStoreEventContext,
  FactoryRunWorkflowContext,
  FactorySeriesRunRequestContext,
  FactorySeriesRunStoreEventContext,
} from "./types";

interface FactoryStoreEventMetadata {
  launchRequestId: string;
  timestamp: string;
  workflow: FactoryRunWorkflowContext;
}

function resolveOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveWorkflowContext(): FactoryRunWorkflowContext {
  const workflowRunId = resolveOptionalNumber(process.env.GITHUB_RUN_ID);
  const workflowRunAttempt = resolveOptionalNumber(process.env.GITHUB_RUN_ATTEMPT);
  const workflowUrl =
    workflowRunId && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${workflowRunId}`
      : undefined;

  return {
    workflowName: process.env.GITHUB_WORKFLOW || DEFAULT_GAME_LAUNCH_WORKFLOW_FILE,
    workflowJob: process.env.GITHUB_JOB,
    workflowRunId,
    workflowRunAttempt,
    workflowUrl,
    ref: process.env.GITHUB_REF_NAME || process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
  };
}

function createLaunchRequestId(): string {
  if (process.env.GITHUB_RUN_ID) {
    return `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`;
  }

  return `local-${Date.now()}`;
}

export function createFactoryStoreEventMetadata(): FactoryStoreEventMetadata {
  return {
    launchRequestId: createLaunchRequestId(),
    timestamp: new Date().toISOString(),
    workflow: resolveWorkflowContext(),
  };
}

export function createFactoryRunStoreEventContext(request: FactoryRunRequestContext): FactoryRunStoreEventContext {
  const metadata = createFactoryStoreEventMetadata();

  return {
    ...request,
    ...metadata,
    inputPath: resolveFactoryLaunchInputPath(request, metadata.launchRequestId),
    executionMode: request.requestedLaunchStep === "full" ? "fast_trial" : "guided_recovery",
  };
}

export function createFactorySeriesRunStoreEventContext(
  request: FactorySeriesRunRequestContext,
): FactorySeriesRunStoreEventContext {
  const metadata = createFactoryStoreEventMetadata();

  return {
    ...request,
    ...metadata,
    inputPath: resolveFactorySeriesLaunchInputPath(request, metadata.launchRequestId),
    executionMode: request.requestedLaunchStep === "full" ? "fast_trial" : "guided_recovery",
  };
}

export function createFactoryRotationRunStoreEventContext(
  request: FactoryRotationRunRequestContext,
): FactoryRotationRunStoreEventContext {
  const metadata = createFactoryStoreEventMetadata();

  return {
    ...request,
    ...metadata,
    inputPath: resolveFactoryRotationLaunchInputPath(request, metadata.launchRequestId),
    executionMode: request.requestedLaunchStep === "full" ? "fast_trial" : "guided_recovery",
  };
}
