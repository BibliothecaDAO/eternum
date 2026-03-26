import { describe, expect, it, vi, beforeEach } from "vitest";

import type { AgentRunJob } from "@bibliothecadao/types";
import type { AgentTurnResult } from "@bibliothecadao/agent-runtime";

vi.mock("../runtime/create-player-agent-runtime", () => ({
  createPlayerAgentRuntime: vi.fn(),
}));
vi.mock("@bibliothecadao/agent-runtime", () => ({
  runAgentTurn: vi.fn(),
}));
vi.mock("./runtime-agent-event-mapper", () => ({
  mapRuntimeEventToAgentEvent: vi.fn(),
}));

import { createPlayerAgentRuntime } from "../runtime/create-player-agent-runtime";
import { runAgentTurn } from "@bibliothecadao/agent-runtime";
import { mapRuntimeEventToAgentEvent } from "./runtime-agent-event-mapper";
import { executeAgentRun } from "./execute-agent-run";

const baseJob: AgentRunJob = {
  jobId: "job-1",
  agentId: "agent-1",
  wakeReason: "scheduled_tick",
  coalescedEventIds: [],
  leaseId: "lease-1",
  priority: 1,
  requestedAt: "2026-03-25T10:00:00.000Z",
};

const mockUnsubscribe = vi.fn();
const mockOnEvent = vi.fn().mockReturnValue(mockUnsubscribe);
const mockDispose = vi.fn().mockResolvedValue(undefined);
const mockRuntime = {
  dataDir: "/tmp/agent-runtime/agent-1",
  onEvent: mockOnEvent,
};
const mockFactory = {
  runtime: mockRuntime,
  buildHeartbeatPrompt: vi.fn().mockReturnValue("test prompt"),
  dispose: mockDispose,
};

const successResult: AgentTurnResult = {
  startedAt: "2026-03-25T10:00:00.000Z",
  finishedAt: "2026-03-25T10:00:05.000Z",
  toolCalls: 2,
  success: true,
};

const failureResult: AgentTurnResult = {
  startedAt: "2026-03-25T10:00:00.000Z",
  finishedAt: "2026-03-25T10:00:05.000Z",
  toolCalls: 0,
  success: false,
  errorMessage: "something went wrong",
};

const mockPersistRun = vi.fn().mockResolvedValue(undefined);
const mockStore = { persistRun: mockPersistRun } as any;

const baseInput = {
  job: baseJob,
  store: mockStore,
  session: { agentId: "agent-1", status: "ready" } as any,
  modelProvider: "anthropic",
  modelId: "claude-sonnet-4-20250514",
};

describe("executeAgentRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPlayerAgentRuntime).mockResolvedValue(mockFactory as any);
    vi.mocked(runAgentTurn).mockResolvedValue(successResult);
    vi.mocked(mapRuntimeEventToAgentEvent).mockImplementation((_agentId, event) => ({
      id: "evt-1",
      agentId: _agentId,
      seq: 0,
      type: "agent.status_changed",
      payload: { runtimeEventType: (event as any).type },
      createdAt: "2026-03-25T10:00:00.000Z",
    }));
  });

  it("calls createPlayerAgentRuntime with correct agentId, session, model params", async () => {
    await executeAgentRun(baseInput);

    expect(createPlayerAgentRuntime).toHaveBeenCalledWith({
      agentId: "agent-1",
      dataDir: "/tmp/agent-runtime/agent-1",
      session: baseInput.session,
      modelProvider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      tickIntervalMs: undefined,
    });
  });

  it("subscribes to runtime events via onEvent", async () => {
    await executeAgentRun(baseInput);

    expect(mockOnEvent).toHaveBeenCalledWith(expect.any(Function));
  });

  it("calls runAgentTurn with heartbeat prompt and turnTimeoutMs", async () => {
    await executeAgentRun({ ...baseInput, turnTimeoutMs: 45_000 });

    expect(runAgentTurn).toHaveBeenCalledWith({
      runtime: mockRuntime,
      prompt: "test prompt",
      wakeReason: "scheduled_tick",
      timeoutMs: 45_000,
    });
  });

  it("on success with tickIntervalMs: computes nextWakeAt (Date in the future)", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    await executeAgentRun({ ...baseInput, tickIntervalMs: 15_000 });

    expect(mockPersistRun).toHaveBeenCalledWith(
      baseJob,
      successResult,
      expect.objectContaining({
        nextWakeAt: new Date(now + 15_000),
      }),
    );

    vi.spyOn(Date, "now").mockRestore();
  });

  it("on success without tickIntervalMs: nextWakeAt is undefined", async () => {
    await executeAgentRun(baseInput);

    expect(mockPersistRun).toHaveBeenCalledWith(
      baseJob,
      successResult,
      expect.objectContaining({
        nextWakeAt: undefined,
      }),
    );
  });

  it("on failure: nextWakeAt is undefined (regardless of tickIntervalMs)", async () => {
    vi.mocked(runAgentTurn).mockResolvedValue(failureResult);

    await executeAgentRun({ ...baseInput, tickIntervalMs: 15_000 });

    expect(mockPersistRun).toHaveBeenCalledWith(
      baseJob,
      failureResult,
      expect.objectContaining({
        nextWakeAt: undefined,
        errorMessage: "something went wrong",
      }),
    );
  });

  it("calls store.persistRun with job, result, events array, nextWakeAt, errorMessage", async () => {
    await executeAgentRun(baseInput);

    expect(mockPersistRun).toHaveBeenCalledWith(baseJob, successResult, {
      dataDir: "/tmp/agent-runtime/agent-1",
      events: [],
      nextWakeAt: undefined,
      errorMessage: undefined,
    });
  });

  it("calls dispose() in finally block even after runAgentTurn throws", async () => {
    vi.mocked(runAgentTurn).mockRejectedValue(new Error("runtime crash"));

    await expect(executeAgentRun(baseInput)).rejects.toThrow("runtime crash");

    expect(mockDispose).toHaveBeenCalledOnce();
  });

  it("unsubscribes from events in finally block", async () => {
    await executeAgentRun(baseInput);

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("unsubscribes from events in finally block even on error", async () => {
    vi.mocked(runAgentTurn).mockRejectedValue(new Error("boom"));

    await expect(executeAgentRun(baseInput)).rejects.toThrow("boom");

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("collects mapped events emitted during execution", async () => {
    // Make runAgentTurn trigger the onEvent callback
    vi.mocked(runAgentTurn).mockImplementation(async () => {
      // Get the callback that was passed to onEvent
      const eventCallback = mockOnEvent.mock.calls[0][0];
      eventCallback({ type: "tool_execution_start", payload: { toolName: "move" } });
      eventCallback({ type: "tool_execution_end", payload: { toolName: "move" } });
      return successResult;
    });

    await executeAgentRun(baseInput);

    expect(mapRuntimeEventToAgentEvent).toHaveBeenCalledTimes(2);
    expect(mapRuntimeEventToAgentEvent).toHaveBeenCalledWith("agent-1", {
      type: "tool_execution_start",
      payload: { toolName: "move" },
    });

    // Events array should have 2 mapped events
    const persistCall = mockPersistRun.mock.calls[0];
    expect(persistCall[2].events).toHaveLength(2);
  });
});
