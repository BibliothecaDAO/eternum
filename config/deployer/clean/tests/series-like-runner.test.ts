import { afterEach, describe, expect, test } from "bun:test";
import { runGroupedSeriesLikeGameStep } from "../launch/series-like-runner";
import { buildInitialSeriesLaunchSummary } from "../launch/series-summary";
import type { LaunchSeriesRequest, LaunchSeriesStepId, SeriesLaunchGameSummary } from "../types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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
      persistSummary: (next) => next,
    });

    for (const game of nextSummary.games) {
      expect(game.status).toBe("succeeded");
      expect(game.latestEvent).toBe("Completed create-worlds");
      expect(game.steps.find((step) => step.id === "create-worlds")?.status).toBe("succeeded");
    }
  });

  test("skips unsupported blitz grouped steps that are not part of the child plan", async () => {
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
      stepId: "grant-village-pass-roles",
      persistSummary: (next) => next,
    });

    expect(nextSummary.games).toEqual(summary.games);
  });

  test("skips wait-for-factory-indexes for children whose create-worlds step never succeeded", async () => {
    const fetchCalls: string[] = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));

      if (fetchCalls.length === 1) {
        return Response.json([
          {
            contract_address: "0x123",
            contract_selector: "0x1",
          },
        ]);
      }

      if (fetchCalls.length === 2) {
        return Response.json([
          {
            address: "0xabc",
          },
        ]);
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

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
      persistSummary: (next) => next,
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
    environmentId: "slot.blitz",
    seriesName: "bltz-knicker",
    games: [
      { gameName: "bltz-knicker-06", startTime: "2099-01-01T06:00:00Z" },
      { gameName: "bltz-knicker-07", startTime: "2099-01-01T07:00:00Z" },
    ],
    cartridgeApiBase: "https://api.cartridge.gg",
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
