import { describe, expect, it, vi } from "vitest";

import type { AgentRunJob } from "@bibliothecadao/types";

import { processAgentRunJob } from "./process-agent-run-job";

const baseJob: AgentRunJob = {
  jobId: "job-1",
  agentId: "agent-1",
  wakeReason: "scheduled_tick",
  coalescedEventIds: [],
  leaseId: "lease-1",
  priority: 1,
  requestedAt: "2026-03-25T10:00:00.000Z",
};

describe("processAgentRunJob", () => {
  it("persists a stage-specific failure when session restore throws", async () => {
    const persistRunFailure = vi.fn(async () => undefined);

    const result = await processAgentRunJob({
      job: baseJob,
      store: {
        loadAgentExecutionConfig: async () => ({
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          tickIntervalMs: 15_000,
          turnTimeoutMs: 45_000,
        }),
        markRunning: async () => true,
        persistRunFailure,
      } as any,
      sessionResolver: {
        load: async () => {
          throw new Error("world auth lookup failed");
        },
      } as any,
      executeAgentRun: vi.fn(),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(persistRunFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        job: baseJob,
        errorCode: "session_restore_failed",
        errorMessage: "world auth lookup failed",
      }),
    );
  });

  it("records an expired session as a failed run before returning", async () => {
    const markSessionExpired = vi.fn(async () => undefined);
    const persistRunFailure = vi.fn(async () => undefined);

    const result = await processAgentRunJob({
      job: baseJob,
      store: {
        loadAgentExecutionConfig: async () => ({
          modelProvider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          tickIntervalMs: 15_000,
          turnTimeoutMs: 45_000,
        }),
        markSessionExpired,
        markRunning: async () => true,
        persistRunFailure,
      } as any,
      sessionResolver: {
        load: async () => ({
          agentId: "agent-1",
          status: "expired",
        }),
      } as any,
      executeAgentRun: vi.fn(),
    });

    expect(result.status).toBe("expired");
    expect(markSessionExpired).toHaveBeenCalledOnce();
    expect(persistRunFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "session_expired",
        executionState: "waiting_auth",
      }),
    );
  });
});
