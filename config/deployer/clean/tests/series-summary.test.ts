import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  buildInitialSeriesLaunchSummary,
  hydrateSeriesLaunchSummary,
  persistSeriesLaunchSummary,
} from "../launch/series-summary";
import { resolveSeriesLaunchSummaryRelativePath } from "../launch/series-io";
import { resolveRepoPath } from "../shared/repo";
import type { LaunchSeriesRequest, SeriesLaunchGameSummary } from "../types";

const originalFetch = globalThis.fetch;
const summaryPath = resolveRepoPath(resolveSeriesLaunchSummaryRelativePath("slot.blitz", "bltz-weekend-cup"));

function buildSeriesRequest(overrides: Partial<LaunchSeriesRequest> = {}): LaunchSeriesRequest {
  return {
    launchKind: "series",
    environmentId: "slot.blitz",
    seriesName: "bltz-weekend-cup",
    games: [
      {
        gameName: "bltz-weekend-cup-03",
        startTime: "2026-03-21T12:00:00Z",
        seriesGameNumber: 1,
      },
    ],
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    cartridgeApiBase: "https://cartridge.example",
    ...overrides,
  };
}

function markSeriesGameComplete(game: SeriesLaunchGameSummary): SeriesLaunchGameSummary {
  return {
    ...game,
    status: "succeeded",
    latestEvent: `Completed ${game.gameName}`,
    steps: game.steps.map((step) => ({
      ...step,
      status: "succeeded",
      latestEvent: `Completed ${step.id}`,
    })),
  };
}

function buildFactoryQueryResponse(rows: unknown) {
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("series launch summary hydration", () => {
  beforeEach(() => {
    globalThis.fetch = async (url) => {
      const requestUrl = String(url);
      const decodedRequestUrl = decodeURIComponent(requestUrl);

      if (decodedRequestUrl.includes("[wf-SeriesGame]")) {
        return buildFactoryQueryResponse([{ game_number: 2 }]);
      }

      if (decodedRequestUrl.includes("[wf-Series]")) {
        return buildFactoryQueryResponse([{ name: "0x123" }]);
      }

      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;

    if (fs.existsSync(summaryPath)) {
      fs.unlinkSync(summaryPath);
    }
  });

  test("appends new games onto an existing series and assigns the next server-side game number", async () => {
    const initialSummary = buildInitialSeriesLaunchSummary({
      ...buildSeriesRequest({
        games: [
          { gameName: "bltz-weekend-cup-01", startTime: "2026-03-19T12:00:00Z" },
          { gameName: "bltz-weekend-cup-02", startTime: "2026-03-20T12:00:00Z" },
        ],
      }),
    });

    persistSeriesLaunchSummary({
      ...initialSummary,
      seriesCreated: true,
      games: initialSummary.games.map((game, index) =>
        markSeriesGameComplete({
          ...game,
          seriesGameNumber: index + 1,
        }),
      ),
    });

    const hydratedSummary = await hydrateSeriesLaunchSummary(buildSeriesRequest());

    expect(hydratedSummary.seriesCreated).toBe(true);
    expect(hydratedSummary.games.map((game) => [game.gameName, game.seriesGameNumber])).toEqual([
      ["bltz-weekend-cup-01", 1],
      ["bltz-weekend-cup-02", 2],
      ["bltz-weekend-cup-03", 3],
    ]);
    expect(hydratedSummary.games[0]?.status).toBe("succeeded");
    expect(hydratedSummary.games[2]?.status).toBe("pending");
  });

  test("rejects append requests that try to rewrite an existing game's start time", async () => {
    const initialSummary = buildInitialSeriesLaunchSummary({
      ...buildSeriesRequest({
        games: [{ gameName: "bltz-weekend-cup-03", startTime: "2026-03-21T12:00:00Z" }],
      }),
    });

    persistSeriesLaunchSummary({
      ...initialSummary,
      seriesCreated: true,
      games: initialSummary.games.map((game) => ({
        ...game,
        seriesGameNumber: 3,
      })),
    });

    await expect(
      hydrateSeriesLaunchSummary(
        buildSeriesRequest({
          games: [{ gameName: "bltz-weekend-cup-03", startTime: "2026-03-21T13:00:00Z" }],
        }),
      ),
    ).rejects.toThrow('Series game "bltz-weekend-cup-03" already exists and cannot be changed by append');
  });
});
