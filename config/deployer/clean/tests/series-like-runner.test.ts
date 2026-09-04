import { afterEach, describe, expect, mock, test } from "bun:test";
import { expectedChainId } from "@realms-world/chain/chain-guard";
import { RpcProvider } from "starknet";
import type { LaunchSeriesRequest, LaunchSeriesStepId, SeriesLaunchGameSummary } from "../types";

mock.module("../../../../contracts/l3/game/manifest_madara.json", () => ({
  default: {
    world: { address: "0xsharedworld" },
    contracts: [
      {
        tag: "s2-registrar_systems",
        address: "0xregistrar",
        abi: [
          { type: "function", name: "bootstrap_chain_config" },
          { type: "function", name: "register_preset" },
          { type: "function", name: "register_series" },
          { type: "function", name: "create_game" },
        ],
      },
    ],
    events: [{ tag: "s2-GameCreated", selector: "0xabc" }],
  },
}));

const { runGroupedSeriesLikeGameStep } = await import("../launch/series-like-runner");
const { buildInitialSeriesLaunchSummary } = await import("../launch/series-summary");

const originalFetch = globalThis.fetch;
const originalGetChainId = RpcProvider.prototype.getChainId;
const originalHeraldUrl = process.env.HERALD_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  RpcProvider.prototype.getChainId = originalGetChainId;
  if (originalHeraldUrl === undefined) delete process.env.HERALD_URL;
  else process.env.HERALD_URL = originalHeraldUrl;
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
      persistSummary: async (next) => next,
    });

    for (const game of nextSummary.games) {
      expect(game.status).toBe("succeeded");
      expect(game.latestEvent).toBe("Completed create-worlds");
      expect(game.steps.find((step) => step.id === "create-worlds")?.status).toBe("succeeded");
    }
  });

  test("skips wait-for-factory-indexes for children whose create-worlds step never succeeded", async () => {
    RpcProvider.prototype.getChainId = async () =>
      expectedChainId("madara") as Awaited<ReturnType<RpcProvider["getChainId"]>>;
    process.env.HERALD_URL = "https://herald.example";
    const fetchCalls: string[] = [];
    globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
      fetchCalls.push(String(url));

      if (fetchCalls.length <= 2) {
        return Response.json({ games: [{ game_id: 7, name: "bltz-knicker-06" }] });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    }) as unknown as typeof fetch;

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
