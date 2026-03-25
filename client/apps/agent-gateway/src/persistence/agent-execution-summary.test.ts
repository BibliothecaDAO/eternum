import { describe, expect, it } from "vitest";

import type { AgentEvent, AgentRunSummary } from "@bibliothecadao/types";

import { buildAgentExecutionSummary, buildLatestActionFromEvents } from "./agent-execution-summary";

describe("buildLatestActionFromEvents", () => {
  it("prefers the latest final tx event and preserves revert details", () => {
    const events: AgentEvent[] = [
      {
        id: "event-1",
        agentId: "agent-1",
        seq: 1,
        type: "agent.action_submitted",
        payload: {
          toolName: "move_army",
          contractAddress: "0xmove",
          entrypoint: "explorer_move",
          calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
          txHash: "0xaaa",
        },
        createdAt: "2026-03-25T10:00:00.000Z",
      },
      {
        id: "event-2",
        agentId: "agent-1",
        seq: 2,
        type: "agent.action_confirmed",
        payload: {
          toolName: "move_army",
          contractAddress: "0xmove",
          entrypoint: "explorer_move",
          calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
          txHash: "0xaaa",
          receiptStatus: "REVERTED",
          isError: true,
          errorMessage: "Not Owner",
        },
        createdAt: "2026-03-25T10:00:05.000Z",
      },
    ];

    expect(buildLatestActionFromEvents(events)).toEqual({
      toolName: "move_army",
      contractAddress: "0xmove",
      entrypoint: "explorer_move",
      calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
      txHash: "0xaaa",
      receiptStatus: "REVERTED",
      status: "failed",
      errorMessage: "Not Owner",
      createdAt: "2026-03-25T10:00:05.000Z",
    });
  });
});

describe("buildAgentExecutionSummary", () => {
  it("combines the latest run and action into a compact summary", () => {
    const latestRun: AgentRunSummary = {
      id: "run-1",
      agentId: "agent-1",
      leaseId: "lease-1",
      wakeReason: "scheduled_tick",
      status: "failed",
      toolCalls: 2,
      mutatingActions: 1,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      startedAt: "2026-03-25T10:00:00.000Z",
      finishedAt: "2026-03-25T10:00:05.000Z",
      errorMessage: "Turn timed out after 45000ms.",
    };

    expect(
      buildAgentExecutionSummary({
        latestAction: {
          toolName: "move_army",
          contractAddress: "0xmove",
          entrypoint: "explorer_move",
          calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
          txHash: "0xaaa",
          receiptStatus: "REVERTED",
          status: "failed",
          errorMessage: "Not Owner",
          createdAt: "2026-03-25T10:00:05.000Z",
        },
        latestRun,
      }),
    ).toEqual({
      lastRunStatus: "failed",
      lastWakeReason: "scheduled_tick",
      lastRunStartedAt: "2026-03-25T10:00:00.000Z",
      lastRunFinishedAt: "2026-03-25T10:00:05.000Z",
      lastErrorMessage: "Turn timed out after 45000ms.",
      latestActionStatus: "failed",
      latestActionAt: "2026-03-25T10:00:05.000Z",
    });
  });
});
