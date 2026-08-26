import { describe, expect, mock, test } from "bun:test";
import { buildSeriesLikeGameLaunchRequest, runGroupedSeriesLikeGameStep } from "../launch/series-like-runner";
import { buildInitialSeriesLaunchSummary } from "../launch/series-summary";
import type { LaunchGameStepRequest, LaunchGameSummary, LaunchSeriesRequest, LaunchSeriesSummary } from "../types";

describe("grouped series-like runner fail-fast behavior", () => {
  test("stops create-worlds after the first failed game", async () => {
    const request = buildSeriesRequest();
    const initialSummary = buildInitialSeriesLaunchSummary(request);
    const summary = {
      ...initialSummary,
      seriesCreated: true,
    };
    const persistedSummaries: LaunchSeriesSummary[] = [];
    const runGameStep = mock(async (_request: LaunchGameStepRequest): Promise<LaunchGameSummary> => {
      throw new Error("create-worlds failed");
    });

    await expect(
      runGroupedSeriesLikeGameStep({
        request,
        summary,
        stepId: "create-worlds",
        persistSummary: (next) => {
          persistedSummaries.push(next);
          return next;
        },
        runGameStep,
      }),
    ).rejects.toThrow("1 rotation or series game failed during create-worlds");

    const persistedSummary = persistedSummaries.at(-1);
    expect(runGameStep).toHaveBeenCalledTimes(1);
    expect(persistedSummary).toBeDefined();
    expect(persistedSummary!.games[0]?.status).toBe("failed");
    expect(persistedSummary!.games[0]?.currentStepId).toBe("create-worlds");
    expect(persistedSummary!.games[1]?.status).toBe("pending");
    expect(persistedSummary!.games[1]?.currentStepId).toBeNull();
    expect(persistedSummary!.games[1]?.steps.find((step) => step.id === "create-worlds")?.status).toBe("pending");
  });

  test("lets child registration overrides replace the series default", () => {
    const request = buildSeriesRequest({
      blitzRegistrationOverrides: { fee_amount: "500000000000000000000" },
    });
    const initialSummary = buildInitialSeriesLaunchSummary(request);
    const summary = {
      ...initialSummary,
      seriesCreated: true,
      games: [
        initialSummary.games[0]!,
        {
          ...initialSummary.games[1]!,
          blitzRegistrationOverrides: { fee_amount: "1000000000000000000000" },
        },
      ],
    };

    const firstRequest = buildSeriesLikeGameLaunchRequest(request, summary, summary.games[0]);
    const secondRequest = buildSeriesLikeGameLaunchRequest(request, summary, summary.games[1]);

    expect(firstRequest.blitzRegistrationOverrides).toEqual({ fee_amount: "500000000000000000000" });
    expect(secondRequest.blitzRegistrationOverrides).toEqual({ fee_amount: "1000000000000000000000" });
  });
});

function buildSeriesRequest(overrides: Partial<LaunchSeriesRequest> = {}): LaunchSeriesRequest {
  return {
    launchKind: "series",
    environmentId: "appchain.blitz",
    seriesName: "bltz-knicker",
    games: [
      { gameName: "bltz-knicker-06", startTime: "2099-01-01T06:00:00Z" },
      { gameName: "bltz-knicker-07", startTime: "2099-01-01T07:00:00Z" },
    ],
    accountAddress: "0x123",
    privateKey: "0x456",
    ...overrides,
  };
}
