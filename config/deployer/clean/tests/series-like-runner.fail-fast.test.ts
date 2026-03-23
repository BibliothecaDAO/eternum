import { afterEach, describe, expect, mock, test } from "bun:test";
import type { LaunchSeriesRequest, LaunchSeriesSummary } from "../types";

const runLaunchStepMock = mock(async ({ gameName }: { gameName: string }) => {
  if (gameName === "bltz-knicker-06") {
    throw new Error("create-worlds failed");
  }

  return {
    gameName,
    configSteps: [],
    durationSeconds: 3600,
  };
});

mock.module("../launch/runner", () => ({
  runLaunchStep: runLaunchStepMock,
}));

const { runGroupedSeriesLikeGameStep } = await import("../launch/series-like-runner");
const { buildInitialSeriesLaunchSummary } = await import("../launch/series-summary");

afterEach(() => {
  runLaunchStepMock.mockClear();
});

describe("grouped series-like runner fail-fast behavior", () => {
  test("stops create-worlds after the first failed game", async () => {
    const request = buildSeriesRequest();
    const initialSummary = buildInitialSeriesLaunchSummary(request);
    const summary = {
      ...initialSummary,
      seriesCreated: true,
    };

    let persistedSummary: LaunchSeriesSummary | null = null;

    await expect(
      runGroupedSeriesLikeGameStep({
        request,
        summary,
        stepId: "create-worlds",
        persistSummary: (next) => {
          persistedSummary = next;
          return next;
        },
      }),
    ).rejects.toThrow("1 rotation or series game failed during create-worlds");

    expect(runLaunchStepMock).toHaveBeenCalledTimes(1);
    expect(runLaunchStepMock.mock.calls[0]?.[0].gameName).toBe("bltz-knicker-06");
    expect(persistedSummary).not.toBeNull();
    expect(persistedSummary?.games[0]?.status).toBe("failed");
    expect(persistedSummary?.games[0]?.currentStepId).toBe("create-worlds");
    expect(persistedSummary?.games[1]?.status).toBe("pending");
    expect(persistedSummary?.games[1]?.currentStepId).toBeNull();
    expect(persistedSummary?.games[1]?.steps.find((step) => step.id === "create-worlds")?.status).toBe("pending");
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
