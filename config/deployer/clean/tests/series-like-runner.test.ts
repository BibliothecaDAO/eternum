import { describe, expect, mock, test } from "bun:test";
import type {
  LaunchGameStepRequest,
  LaunchGameSummary,
  LaunchSeriesRequest,
  LaunchSeriesStepId,
  SeriesLaunchGameSummary,
} from "../types";
import { runGroupedSeriesLikeGameStep } from "../launch/series-like-runner";
import { buildInitialSeriesLaunchSummary } from "../launch/series-summary";

describe("grouped series-like runner", () => {
  test("treats the parent series as the create-worlds prerequisite", async () => {
    const request = buildSeriesRequest({
      dryRun: true,
    });
    const initialSummary = buildInitialSeriesLaunchSummary(request);
    const summary = {
      ...initialSummary,
      seriesCreated: true,
    };

    const nextSummary = await runGroupedSeriesLikeGameStep({
      request,
      summary,
      stepId: "create-worlds",
      persistSummary: async (next) => next,
    });

    for (const game of nextSummary.games) {
      expect(game.status).toBe("succeeded");
      expect(game.latestEvent).toBe("Completed create-worlds");
      expect(game.steps.find((step) => step.id === "create-worlds")?.status).toBe("succeeded");
    }
  });

  test("skips wait-for-factory-indexes for children whose create-worlds step never succeeded", async () => {
    const runGameStep = mock(
      async (step: LaunchGameStepRequest): Promise<LaunchGameSummary> => ({
        environment: "madara.blitz",
        chain: "madara",
        gameType: "blitz",
        gameName: step.gameName,
        startTime: 4070930400,
        startTimeIso: "2099-01-01T06:00:00.000Z",
        rpcUrl: "https://rpc.example",
        gameId: 7,
        configMode: "batched",
        configSteps: [],
        dryRun: false,
      }),
    );

    const request = buildSeriesRequest({
      waitForFactoryIndexTimeoutMs: 25,
      waitForFactoryIndexPollMs: 1,
    });
    const initialSummary = buildInitialSeriesLaunchSummary(request);
    const summary = {
      ...initialSummary,
      seriesCreated: true,
      games: [
        markSeriesGameStepStatus(initialSummary.games[0], "create-worlds", "succeeded", "Completed create-worlds"),
        markSeriesGameStepStatus(
          initialSummary.games[1],
          "create-worlds",
          "failed",
          "create-worlds failed",
          "create_game reverted",
        ),
      ],
    };

    const nextSummary = await runGroupedSeriesLikeGameStep({
      request,
      summary,
      stepId: "wait-for-factory-indexes",
      persistSummary: async (next) => next,
      runGameStep,
    });

    expect(runGameStep).toHaveBeenCalledTimes(1);
    expect(runGameStep.mock.calls[0]?.[0]).toMatchObject({
      gameName: "bltz-knicker-06",
      stepId: "wait-for-factory-index",
    });
    expect(nextSummary.games[0]?.steps.find((step) => step.id === "wait-for-factory-indexes")?.status).toBe(
      "succeeded",
    );
    expect(nextSummary.games[1]?.currentStepId).toBe("create-worlds");
    expect(nextSummary.games[1]?.status).toBe("failed");
    expect(nextSummary.games[1]?.steps.find((step) => step.id === "wait-for-factory-indexes")?.status).toBe("pending");
  });
});

function buildSeriesRequest(overrides: Partial<LaunchSeriesRequest> = {}): LaunchSeriesRequest {
  return {
    launchKind: "series",
    environmentId: "madara.blitz",
    rpcUrl: "https://rpc.example",
    seriesName: "bltz-knicker",
    games: [
      { gameName: "bltz-knicker-06", startTime: "2099-01-01T06:00:00Z" },
      { gameName: "bltz-knicker-07", startTime: "2099-01-01T07:00:00Z" },
    ],
    ...overrides,
  };
}

function markSeriesGameStepStatus(
  game: SeriesLaunchGameSummary,
  stepId: LaunchSeriesStepId,
  status: "succeeded" | "failed",
  latestEvent: string,
  errorMessage?: string,
): SeriesLaunchGameSummary {
  return {
    ...game,
    currentStepId: status === "succeeded" ? null : stepId,
    latestEvent,
    status,
    steps: game.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status,
            latestEvent,
            errorMessage,
          }
        : step,
    ),
  };
}
