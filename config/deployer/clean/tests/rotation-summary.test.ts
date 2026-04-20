import { describe, expect, test } from "bun:test";
import { buildInitialRotationLaunchSummary, reconcileRotationLaunchSummary } from "../launch/rotation-summary";
import type { LaunchRotationRequest } from "../types";

function buildWeeklyRotationRequest(overrides: Partial<LaunchRotationRequest> = {}): LaunchRotationRequest {
  return {
    launchKind: "rotation",
    environmentId: "mainnet.blitz",
    rotationName: "blitz-rotation",
    firstGameStartTime: "2026-04-20T01:00:00Z",
    gameIntervalMinutes: 0,
    maxGames: 5200,
    advanceWindowGames: 5,
    evaluationIntervalMinutes: 15,
    durationSeconds: 3600,
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    weeklyCadence: [
      { gameNamePrefix: "na-gladiator", weekday: "monday", utcTime: "01:00" },
      { gameNamePrefix: "apac-gladiator", weekday: "tuesday", utcTime: "11:00" },
      { gameNamePrefix: "na-gladiator", weekday: "wednesday", utcTime: "02:00" },
      { gameNamePrefix: "eu-gladiator", weekday: "wednesday", utcTime: "19:00" },
      { gameNamePrefix: "apac-gladiator", weekday: "thursday", utcTime: "10:00" },
      { gameNamePrefix: "na-gladiator", weekday: "friday", utcTime: "01:00" },
      { gameNamePrefix: "eu-gladiator", weekday: "friday", utcTime: "18:00" },
      { gameNamePrefix: "apac-gladiator", weekday: "saturday", utcTime: "12:00" },
      { gameNamePrefix: "eu-gladiator", weekday: "saturday", utcTime: "20:00" },
      { gameNamePrefix: "na-gladiator", weekday: "sunday", utcTime: "03:00" },
      { gameNamePrefix: "apac-gladiator", weekday: "sunday", utcTime: "11:00" },
      { gameNamePrefix: "eu-gladiator", weekday: "sunday", utcTime: "19:00" },
    ],
    ...overrides,
  };
}

describe("rotation launch summary", () => {
  test("keeps a rolling weekly cadence filled from the next future slot", () => {
    const request = buildWeeklyRotationRequest();
    const summary = reconcileRotationLaunchSummary(
      request,
      buildInitialRotationLaunchSummary(request),
      Date.parse("2026-04-20T07:00:00Z"),
    );

    expect(summary.games.map((game) => [game.gameName, game.startTimeIso])).toEqual([
      ["apac-gladiator-21-04-26", "2026-04-21T11:00:00.000Z"],
      ["na-gladiator-22-04-26", "2026-04-22T02:00:00.000Z"],
      ["eu-gladiator-22-04-26", "2026-04-22T19:00:00.000Z"],
      ["apac-gladiator-23-04-26", "2026-04-23T10:00:00.000Z"],
      ["na-gladiator-24-04-26", "2026-04-24T01:00:00.000Z"],
    ]);
  });

  test("continues a weekly cadence into the next week", () => {
    const request = buildWeeklyRotationRequest({ advanceWindowGames: 1 });
    const initialSummary = reconcileRotationLaunchSummary(
      request,
      {
        ...buildInitialRotationLaunchSummary(request),
        games: [
          {
            gameName: "eu-gladiator-26-04-26",
            startTime: Math.floor(Date.parse("2026-04-26T19:00:00Z") / 1000),
            startTimeIso: "2026-04-26T19:00:00.000Z",
            durationSeconds: 3600,
            seriesGameNumber: 12,
            currentStepId: null,
            latestEvent: "Waiting to run",
            status: "pending",
            configSteps: [],
            steps: [],
            artifacts: {},
          },
        ],
      },
      Date.parse("2026-04-26T20:00:00Z"),
    );

    expect(initialSummary.games.at(-1)).toMatchObject({
      gameName: "na-gladiator-27-04-26",
      startTimeIso: "2026-04-27T01:00:00.000Z",
      seriesGameNumber: 13,
    });
  });

  test("applies weekly cadence registration overrides to generated games", () => {
    const request = buildWeeklyRotationRequest({
      advanceWindowGames: 1,
      weeklyCadence: [
        {
          gameNamePrefix: "weekend-gladiator",
          weekday: "saturday",
          utcTime: "12:00",
          blitzRegistrationOverrides: {
            fee_amount: "1000000000000000000000",
          },
        },
      ],
    });
    const summary = reconcileRotationLaunchSummary(
      request,
      buildInitialRotationLaunchSummary(request),
      Date.parse("2026-04-20T07:00:00Z"),
    );

    expect(summary.games[0]).toMatchObject({
      gameName: "weekend-gladiator-25-04-26",
      blitzRegistrationOverrides: {
        fee_amount: "1000000000000000000000",
      },
    });
  });
});
