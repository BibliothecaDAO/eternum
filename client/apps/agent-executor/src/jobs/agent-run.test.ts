import { describe, expect, it, vi } from "vitest";

import { runAgentRunJob } from "./agent-run";

describe("agent executor job orchestration", () => {
  it("loads session and artifacts, runs a turn, and persists the result", async () => {
    const persistRunResult = vi.fn(async () => {});
    const runtimeDispose = vi.fn(async () => {});
    const runtimePrompt = vi.fn(async () => {});

    const result = await runAgentRunJob(
      {
        artifactStore: {
          load: async () => ({
            agentId: "agent-1",
            files: {
              "memory.md": "remember this",
            },
          }),
          save: async () => {},
        },
        sessionResolver: {
          load: async () => ({
            agentId: "agent-1",
            status: "ready",
          }),
        },
        createRuntime: async () => ({
          dataDir: "/tmp/agent-runtime/agent-1",
          isBusy: () => false,
          prompt: runtimePrompt,
          followUp: () => {},
          reloadPrompt: () => {},
          onEvent: () => () => {},
          dispose: runtimeDispose,
        }),
        persistRunResult,
        resolveSteeringOverlay: async () => ({
          jobType: "scout",
          summary: "Prioritize exploration around nearby fogged zones.",
          promptSupplement: "Favor scouting unexplored nearby tiles before economic actions.",
          taskOverrides: {
            exploration: "high",
          },
          runtimeConfigOverrides: {
            maxToolCalls: 4,
          },
          memoryNote: "Current steering: scout nearby territory.",
          updatedAt: new Date().toISOString(),
        }),
      } as any,
      {
        jobId: "job-1",
        agentId: "agent-1",
        wakeReason: "user_prompt",
        coalescedEventIds: [],
        leaseId: "lease-1",
        priority: 0,
        requestedAt: new Date().toISOString(),
      },
    );

    expect(result.success).toBe(true);
    expect(runtimePrompt).toHaveBeenCalledWith(expect.stringContaining("Favor scouting unexplored nearby tiles"));
    expect(runtimeDispose).toHaveBeenCalled();
    expect(persistRunResult).toHaveBeenCalledOnce();
  });
});
