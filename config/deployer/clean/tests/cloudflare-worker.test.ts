import { afterEach, describe, expect, test } from "bun:test";
import worker from "../run-store/cloudflare-worker.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("factory worker map config overrides", () => {
  test("forwards map config overrides when creating a run", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/slot/eternum/etrn-test-9.json")) {
        return new Response("{}", { status: 404 });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "slot.eternum",
          gameName: "etrn-test-9",
          gameStartTime: "2026-03-18T10:00:00Z",
          mapConfigOverrides: {
            bitcoinMineWinProbability: 1638,
            bitcoinMineFailProbability: 63897,
          },
        }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.map_config_overrides_json).toBe(
      JSON.stringify({
        bitcoinMineWinProbability: 1638,
        bitcoinMineFailProbability: 63897,
      }),
    );
  });

  test("forwards blitz registration overrides when creating a run", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/slot/blitz/bltz-test-9.json")) {
        return new Response("{}", { status: 404 });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "slot.blitz",
          gameName: "bltz-test-9",
          gameStartTime: "2026-03-18T10:00:00Z",
          blitzRegistrationOverrides: {
            registration_count_max: 12,
            fee_token: "0x1234",
            fee_amount: "40000",
          },
        }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.blitz_registration_overrides_json).toBe(
      JSON.stringify({
        registration_count_max: 12,
        fee_token: "0x1234",
        fee_amount: "40000",
      }),
    );
  });

  test("accepts mainnet environments when creating a run", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/mainnet/blitz/bltz-test-mainnet.json")) {
        return new Response("{}", { status: 404 });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "mainnet.blitz",
          gameName: "bltz-test-mainnet",
          gameStartTime: "2026-03-18T10:00:00Z",
        }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.environment).toBe("mainnet.blitz");
  });

  test("dispatches rotation launches with rotation-specific inputs", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/slot/blitz/rotations/bltz-ladder-loop.json")) {
        return new Response("{}", { status: 404 });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/rotation-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "slot.blitz",
          rotationName: "bltz-ladder-loop",
          firstGameStartTime: "2026-03-18T10:00:00Z",
          gameIntervalMinutes: 60,
          maxGames: 12,
          advanceWindowGames: 5,
          evaluationIntervalMinutes: 30,
          autoRetryIntervalMinutes: 15,
        }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.launch_kind).toBe("rotation");
    expect(dispatchBody.inputs.rotation_name).toBe("bltz-ladder-loop");
    expect(dispatchBody.inputs.first_game_start_time).toBe("2026-03-18T10:00:00Z");
    expect(dispatchBody.inputs.game_interval_minutes).toBe("60");
    expect(dispatchBody.inputs.max_games).toBe("12");
    expect(dispatchBody.inputs.advance_window_games).toBe("5");
    expect(dispatchBody.inputs.evaluation_interval_minutes).toBe("30");
    expect(dispatchBody.inputs.auto_retry_interval_minutes).toBe("15");
  });

  test("reuses stored map config overrides during continue", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/slot/eternum/etrn-test-9.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.eternum",
          gameName: "etrn-test-9",
          inputPath: "inputs/slot/eternum/etrn-test-9/101-1.json",
          steps: [
            { id: "create-world", status: "succeeded" },
            { id: "wait-for-factory-index", status: "succeeded" },
            { id: "configure-world", status: "pending" },
          ],
        });
      }

      if (String(url).includes("/contents/inputs/slot/eternum/etrn-test-9/101-1.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.eternum",
          gameName: "etrn-test-9",
          startTime: "2026-03-18T10:00:00Z",
          request: {
            environmentId: "slot.eternum",
            gameName: "etrn-test-9",
            startTime: "2026-03-18T10:00:00Z",
            mapConfigOverrides: {
              bitcoinMineWinProbability: 1638,
              bitcoinMineFailProbability: 63897,
            },
          },
        });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/slot.eternum/etrn-test-9/actions/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchStep: "configure-world" }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.map_config_overrides_json).toBe(
      JSON.stringify({
        bitcoinMineWinProbability: 1638,
        bitcoinMineFailProbability: 63897,
      }),
    );
  });

  test("reuses stored blitz registration overrides during continue", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/slot/blitz/bltz-test-9.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.blitz",
          gameName: "bltz-test-9",
          inputPath: "inputs/slot/blitz/bltz-test-9/101-1.json",
          steps: [
            { id: "create-world", status: "succeeded" },
            { id: "wait-for-factory-index", status: "succeeded" },
            { id: "configure-world", status: "pending" },
          ],
        });
      }

      if (String(url).includes("/contents/inputs/slot/blitz/bltz-test-9/101-1.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.blitz",
          gameName: "bltz-test-9",
          startTime: "2026-03-18T10:00:00Z",
          request: {
            environmentId: "slot.blitz",
            gameName: "bltz-test-9",
            startTime: "2026-03-18T10:00:00Z",
            blitzRegistrationOverrides: {
              registration_count_max: 12,
              fee_token: "0x1234",
              fee_amount: "40000",
            },
          },
        });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/slot.blitz/bltz-test-9/actions/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchStep: "configure-world" }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.blitz_registration_overrides_json).toBe(
      JSON.stringify({
        registration_count_max: 12,
        fee_token: "0x1234",
        fee_amount: "40000",
      }),
    );
  });

  test("allows sync-paymaster recovery for mainnet runs", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/mainnet/eternum/etrn-test-10.json")) {
        return buildGitHubContentsResponse({
          environment: "mainnet.eternum",
          gameName: "etrn-test-10",
          inputPath: "inputs/mainnet/eternum/etrn-test-10/101-1.json",
          steps: [
            { id: "create-world", status: "succeeded" },
            { id: "wait-for-factory-index", status: "succeeded" },
            { id: "configure-world", status: "succeeded" },
            { id: "grant-lootchest-role", status: "succeeded" },
            { id: "grant-village-pass-role", status: "succeeded" },
            { id: "create-banks", status: "succeeded" },
            { id: "create-indexer", status: "succeeded" },
            { id: "sync-paymaster", status: "pending" },
          ],
        });
      }

      if (String(url).includes("/contents/inputs/mainnet/eternum/etrn-test-10/101-1.json")) {
        return buildGitHubContentsResponse({
          environment: "mainnet.eternum",
          gameName: "etrn-test-10",
          startTime: "2026-03-18T10:00:00Z",
          request: {
            environmentId: "mainnet.eternum",
            gameName: "etrn-test-10",
            startTime: "2026-03-18T10:00:00Z",
          },
        });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/mainnet.eternum/etrn-test-10/actions/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchStep: "sync-paymaster" }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.launch_step).toBe("sync-paymaster");
    expect(dispatchBody.inputs.environment).toBe("mainnet.eternum");
  });

  test("rejects sync-paymaster recovery for slot runs", async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("/contents/runs/slot/blitz/bltz-test-10.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.blitz",
          gameName: "bltz-test-10",
          inputPath: "inputs/slot/blitz/bltz-test-10/101-1.json",
          steps: [
            { id: "create-world", status: "succeeded" },
            { id: "wait-for-factory-index", status: "succeeded" },
            { id: "configure-world", status: "succeeded" },
            { id: "grant-lootchest-role", status: "succeeded" },
            { id: "create-indexer", status: "succeeded" },
          ],
        });
      }

      if (String(url).includes("/contents/inputs/slot/blitz/bltz-test-10/101-1.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.blitz",
          gameName: "bltz-test-10",
          startTime: "2026-03-18T10:00:00Z",
          request: {
            environmentId: "slot.blitz",
            gameName: "bltz-test-10",
            startTime: "2026-03-18T10:00:00Z",
          },
        });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/slot.blitz/bltz-test-10/actions/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchStep: "sync-paymaster" }),
      }),
      buildWorkerEnv(),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Launch step "sync-paymaster" is only supported for mainnet environments',
    });
  });
});

describe("factory worker recovery signals", () => {
  test("keeps step handoffs transitioning until the run has gone stale", async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes("/contents/runs/slot/blitz/bltz-test-11.json")) {
        return buildGitHubContentsResponse({
          version: 1,
          runId: "slot.blitz:bltz-test-11",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          gameName: "bltz-test-11",
          status: "running",
          executionMode: "fast_trial",
          requestedLaunchStep: "full",
          inputPath: "inputs/slot/blitz/bltz-test-11/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: "configure-world",
          createdAt: offsetTimestamp(-60_000),
          updatedAt: offsetTimestamp(-5_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          steps: [
            {
              id: "create-world",
              title: "Creating world",
              status: "succeeded",
              workflowStepName: "Creating world",
              latestEvent: "Creating world succeeded",
            },
            {
              id: "wait-for-factory-index",
              title: "Waiting for game",
              status: "succeeded",
              workflowStepName: "Waiting for game",
              latestEvent: "Waiting for game succeeded",
            },
            {
              id: "configure-world",
              title: "Applying settings",
              status: "pending",
              workflowStepName: "Applying settings",
              latestEvent: "Waiting to run",
            },
          ],
          artifacts: {},
        });
      }

      if (String(url).includes("/contents/runs/slot/blitz/bltz-test-12.json")) {
        return buildGitHubContentsResponse({
          version: 1,
          runId: "slot.blitz:bltz-test-12",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          gameName: "bltz-test-12",
          status: "running",
          executionMode: "fast_trial",
          requestedLaunchStep: "full",
          inputPath: "inputs/slot/blitz/bltz-test-12/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: "configure-world",
          createdAt: offsetTimestamp(-60_000),
          updatedAt: offsetTimestamp(-30_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          steps: [
            {
              id: "create-world",
              title: "Creating world",
              status: "succeeded",
              workflowStepName: "Creating world",
              latestEvent: "Creating world succeeded",
            },
            {
              id: "wait-for-factory-index",
              title: "Waiting for game",
              status: "succeeded",
              workflowStepName: "Waiting for game",
              latestEvent: "Waiting for game succeeded",
            },
            {
              id: "configure-world",
              title: "Applying settings",
              status: "pending",
              workflowStepName: "Applying settings",
              latestEvent: "Waiting to run",
            },
          ],
          artifacts: {},
        });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const transitioningResponse = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/slot.blitz/bltz-test-11"),
      buildWorkerEnv(),
    );
    const stalledResponse = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/slot.blitz/bltz-test-12"),
      buildWorkerEnv(),
    );

    const transitioningRun = await transitioningResponse.json();
    const stalledRun = await stalledResponse.json();

    expect(transitioningRun.recovery).toEqual({
      state: "transitioning",
      canContinue: false,
      continueStepId: null,
    });
    expect(stalledRun.recovery).toEqual({
      state: "stalled",
      canContinue: true,
      continueStepId: "configure-world",
    });
  });

  test("rejects duplicate series game names before dispatching a workflow", async () => {
    globalThis.fetch = async () => {
      throw new Error("Series validation should fail before any GitHub calls");
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/series-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "slot.blitz",
          seriesName: "bltz-weekend-cup",
          games: [
            { gameName: "bltz-weekend-cup-01", startTime: "2026-03-18T10:00:00Z", seriesGameNumber: 1 },
            { gameName: "bltz-weekend-cup-01", startTime: "2026-03-18T11:00:00Z", seriesGameNumber: 2 },
          ],
        }),
      }),
      buildWorkerEnv(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Series game "bltz-weekend-cup-01" was requested more than once',
    });
  });

  test("dispatches targeted rotation indexer recovery for selected child games", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/contents/runs/slot/blitz/rotations/bltz-knicker.json")) {
        return buildGitHubContentsResponse({
          version: 1,
          kind: "rotation",
          runId: "slot.blitz:rotation:bltz-knicker",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          rotationName: "bltz-knicker",
          seriesName: "bltz-knicker",
          status: "attention",
          executionMode: "guided_recovery",
          requestedLaunchStep: "create-indexers",
          inputPath: "inputs/slot/blitz/rotations/bltz-knicker/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: "create-indexers",
          createdAt: offsetTimestamp(-60_000),
          updatedAt: offsetTimestamp(-30_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          steps: [
            {
              id: "create-series",
              title: "Create series",
              status: "succeeded",
              workflowStepName: "Create series",
              latestEvent: "Create series succeeded",
            },
            {
              id: "create-indexers",
              title: "Create indexers",
              status: "failed",
              workflowStepName: "Create indexers",
              latestEvent: "Create indexers failed",
            },
          ],
          autoRetry: { enabled: true, intervalMinutes: 15 },
          evaluation: { intervalMinutes: 15, nextEvaluationAt: offsetTimestamp(15 * 60_000) },
          summary: {
            environment: "slot.blitz",
            chain: "slot",
            gameType: "blitz",
            rotationName: "bltz-knicker",
            seriesName: "bltz-knicker",
            firstGameStartTime: 1774195200,
            firstGameStartTimeIso: "2026-03-22T16:00:00.000Z",
            gameIntervalMinutes: 60,
            maxGames: 12,
            advanceWindowGames: 5,
            evaluationIntervalMinutes: 15,
            rpcUrl: "https://rpc.example",
            factoryAddress: "0x123",
            autoRetryEnabled: true,
            autoRetryIntervalMinutes: 15,
            dryRun: false,
            configMode: "batched",
            seriesCreated: true,
            games: [{ gameName: "bltz-knicker-01" }, { gameName: "bltz-knicker-02" }, { gameName: "bltz-knicker-03" }],
          },
          artifacts: {
            summaryPath: ".context/game-launch/rotation-slot-blitz-bltz-knicker.json",
            seriesCreated: true,
          },
        });
      }

      if (String(url).includes("/contents/inputs/slot/blitz/rotations/bltz-knicker/101-1.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.blitz",
          rotationName: "bltz-knicker",
          request: {
            environmentId: "slot.blitz",
            rotationName: "bltz-knicker",
            firstGameStartTime: "2026-03-22T16:00:00Z",
            gameIntervalMinutes: 60,
            maxGames: 12,
            advanceWindowGames: 5,
            evaluationIntervalMinutes: 15,
          },
        });
      }

      if (String(url).includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/rotation-runs/slot.blitz/bltz-knicker/actions/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          launchStep: "create-indexers",
          gameNames: ["bltz-knicker-03"],
        }),
      }),
      buildWorkerEnv(),
    );

    const dispatchCall = fetchCalls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.launch_step).toBe("create-indexers");
    expect(dispatchBody.inputs.target_game_names_json).toBe(JSON.stringify(["bltz-knicker-03"]));
  });

  test("requires the admin secret for manual indexer tier updates", async () => {
    let didCallGitHub = false;
    globalThis.fetch = async () => {
      didCallGitHub = true;
      throw new Error("Unauthorized requests should not reach GitHub");
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/indexers/tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "slot.blitz",
          gameName: "bltz-test-13",
          tier: "legendary",
        }),
      }),
      buildWorkerEnv({ FACTORY_WORKER_ADMIN_SECRET: "factory-secret" }),
    );

    expect(response.status).toBe(401);
    expect(didCallGitHub).toBe(false);
  });

  test("cancels auto retry for a rotation run when the admin secret is provided", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (
        String(url).includes("/contents/runs/slot/blitz/rotations/bltz-rotationx.json") &&
        (!init?.method || init.method === "GET")
      ) {
        return buildGitHubContentsResponse({
          version: 1,
          kind: "rotation",
          runId: "slot.blitz:rotation:bltz-rotationx",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          rotationName: "bltz-rotationx",
          seriesName: "bltz-rotationx",
          status: "attention",
          executionMode: "guided_recovery",
          requestedLaunchStep: "full",
          inputPath: "inputs/slot/blitz/rotations/bltz-rotationx/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: "create-worlds",
          createdAt: offsetTimestamp(-60_000),
          updatedAt: offsetTimestamp(-30_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          autoRetry: {
            enabled: true,
            intervalMinutes: 15,
            nextRetryAt: offsetTimestamp(15 * 60_000),
          },
          evaluation: {
            intervalMinutes: 15,
            nextEvaluationAt: offsetTimestamp(15 * 60_000),
          },
          steps: [],
          summary: {
            environment: "slot.blitz",
            chain: "slot",
            gameType: "blitz",
            rotationName: "bltz-rotationx",
            seriesName: "bltz-rotationx",
            firstGameStartTime: 1774195200,
            firstGameStartTimeIso: "2026-03-22T16:00:00.000Z",
            gameIntervalMinutes: 60,
            maxGames: 12,
            advanceWindowGames: 5,
            evaluationIntervalMinutes: 15,
            rpcUrl: "https://rpc.example",
            factoryAddress: "0x123",
            autoRetryEnabled: true,
            autoRetryIntervalMinutes: 15,
            dryRun: false,
            configMode: "batched",
            seriesCreated: true,
            games: [],
          },
          artifacts: {
            summaryPath: ".context/game-launch/rotation-slot-blitz-bltz-rotationx.json",
            seriesCreated: true,
          },
        });
      }

      if (String(url).includes("/contents/runs/slot/blitz/rotations/bltz-rotationx.json") && init?.method === "PUT") {
        return new Response(JSON.stringify({ content: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request(
        "https://worker.example/api/factory/rotation-runs/slot.blitz/bltz-rotationx/actions/cancel-auto-retry",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-factory-admin-secret": "factory-secret",
          },
          body: JSON.stringify({
            cancelReason: "operator stopped the loop",
          }),
        },
      ),
      buildWorkerEnv({ FACTORY_WORKER_ADMIN_SECRET: "factory-secret" }),
    );

    const updateCall = fetchCalls.find(
      (call) =>
        call.url.includes("/contents/runs/slot/blitz/rotations/bltz-rotationx.json") && call.init?.method === "PUT",
    );
    const updateBody = JSON.parse(String(updateCall?.init?.body));
    const nextRunRecord = JSON.parse(Buffer.from(updateBody.content, "base64").toString("utf8"));

    expect(response.status).toBe(200);
    expect(nextRunRecord.autoRetry.enabled).toBe(false);
    expect(nextRunRecord.autoRetry.nextRetryAt).toBeUndefined();
    expect(nextRunRecord.autoRetry.cancelledAt).toEqual(expect.any(String));
    expect(nextRunRecord.autoRetry.cancelReason).toBe("operator stopped the loop");
  });

  test("records pending indexer tier updates without overwriting the current tier", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (
        String(url).includes("/contents/runs/slot/blitz/bltz-test-14.json") &&
        (!init?.method || init.method === "GET")
      ) {
        return buildGitHubContentsResponse({
          version: 1,
          kind: "game",
          runId: "slot.blitz:bltz-test-14",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          gameName: "bltz-test-14",
          status: "complete",
          executionMode: "fast_trial",
          requestedLaunchStep: "full",
          inputPath: "inputs/slot/blitz/bltz-test-14/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: null,
          createdAt: offsetTimestamp(-60_000),
          updatedAt: offsetTimestamp(-30_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          steps: [],
          artifacts: {
            indexerCreated: true,
            indexerTier: "basic",
          },
        });
      }

      if (String(url).includes("/contents/inputs/slot/blitz/bltz-test-14/101-1.json")) {
        return buildGitHubContentsResponse({
          workflow: {
            ref: "codex/factory-v2-rotation-review",
          },
          request: {},
        });
      }

      if (String(url).includes("/actions/workflows/factory-torii-deployer.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      if (String(url).includes("/contents/runs/slot/blitz/bltz-test-14.json") && init?.method === "PUT") {
        return new Response(JSON.stringify({ content: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/indexers/tier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-factory-admin-secret": "factory-secret",
        },
        body: JSON.stringify({
          environment: "slot.blitz",
          gameName: "bltz-test-14",
          tier: "legendary",
        }),
      }),
      buildWorkerEnv({ FACTORY_WORKER_ADMIN_SECRET: "factory-secret" }),
    );

    const updateCall = fetchCalls.find(
      (call) => call.url.includes("/contents/runs/slot/blitz/bltz-test-14.json") && call.init?.method === "PUT",
    );
    const updateBody = JSON.parse(String(updateCall?.init?.body));
    const nextRunRecord = JSON.parse(Buffer.from(updateBody.content, "base64").toString("utf8"));

    expect(response.status).toBe(202);
    expect(nextRunRecord.artifacts.indexerTier).toBe("basic");
    expect(nextRunRecord.artifacts.pendingIndexerTierTarget).toBe("legendary");
    expect(nextRunRecord.artifacts.pendingIndexerTierRequestedAt).toEqual(expect.any(String));
  });

  test("scheduled tier reconciliation uses the stored workflow ref and keeps reconciling after one child fails", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    let dispatchCount = 0;
    const startedAt = new Date(Date.now() - 60_000).toISOString();

    globalThis.fetch = async (url, init) => {
      const value = String(url);
      fetchCalls.push({ url: value, init });

      if (value.includes("/contents/runs/") && value.includes("?ref=factory-runs") && !value.includes(".json?ref=")) {
        if (value.includes("/contents/runs/slot/blitz/series?ref=factory-runs")) {
          return buildGitHubDirectoryResponse([{ type: "file", path: "runs/slot/blitz/series/bltz-knicker.json" }]);
        }

        return buildGitHubDirectoryResponse([]);
      }

      if (
        value.includes("/contents/runs/slot/blitz/series/bltz-knicker.json") &&
        (!init?.method || init.method === "GET")
      ) {
        return buildGitHubContentsResponse({
          version: 1,
          kind: "series",
          runId: "slot.blitz:series:bltz-knicker",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          seriesName: "bltz-knicker",
          status: "running",
          executionMode: "fast_trial",
          requestedLaunchStep: "full",
          inputPath: "inputs/slot/blitz/series/bltz-knicker/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: null,
          createdAt: offsetTimestamp(-120_000),
          updatedAt: offsetTimestamp(-30_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          steps: [],
          summary: {
            games: [
              {
                gameName: "bltz-knicker-01",
                startTime: startedAt,
                durationSeconds: 3600,
                artifacts: {
                  indexerCreated: true,
                  indexerTier: "basic",
                },
              },
              {
                gameName: "bltz-knicker-02",
                startTime: startedAt,
                durationSeconds: 3600,
                artifacts: {
                  indexerCreated: true,
                  indexerTier: "basic",
                },
              },
            ],
          },
        });
      }

      if (value.includes("/contents/inputs/slot/blitz/series/bltz-knicker/101-1.json")) {
        return buildGitHubContentsResponse({
          workflow: {
            ref: "codex/factory-v2-rotation-review",
          },
          request: {},
        });
      }

      if (value.includes("/actions/workflows/factory-torii-deployer.yml/dispatches")) {
        dispatchCount += 1;

        if (dispatchCount === 1) {
          return new Response(JSON.stringify({ message: "dispatch exploded" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(null, { status: 204 });
      }

      if (value.includes("/contents/runs/slot/blitz/series/bltz-knicker.json") && init?.method === "PUT") {
        return new Response(JSON.stringify({ content: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch call: ${value}`);
    };

    const scheduledTasks: Promise<unknown>[] = [];
    await worker.scheduled({}, buildWorkerEnv({ GITHUB_WORKFLOW_REF: "next" }), {
      waitUntil(promise: Promise<unknown>) {
        scheduledTasks.push(promise);
      },
    });
    await Promise.all(scheduledTasks);

    const dispatchCalls = fetchCalls.filter((call) =>
      call.url.includes("/actions/workflows/factory-torii-deployer.yml/dispatches"),
    );
    const updateCall = fetchCalls.find(
      (call) => call.url.includes("/contents/runs/slot/blitz/series/bltz-knicker.json") && call.init?.method === "PUT",
    );
    const updateBody = JSON.parse(String(updateCall?.init?.body));
    const nextRunRecord = JSON.parse(Buffer.from(updateBody.content, "base64").toString("utf8"));
    const firstGame = nextRunRecord.summary.games.find(
      (game: { gameName: string }) => game.gameName === "bltz-knicker-01",
    );
    const secondGame = nextRunRecord.summary.games.find(
      (game: { gameName: string }) => game.gameName === "bltz-knicker-02",
    );
    const firstDispatchBody = JSON.parse(String(dispatchCalls[0]?.init?.body));

    expect(dispatchCalls).toHaveLength(2);
    expect(firstDispatchBody.ref).toBe("codex/factory-v2-rotation-review");
    expect(firstGame.artifacts.lastIndexerTierDispatchTarget).toBe("legendary");
    expect(firstGame.artifacts.lastIndexerTierDispatchFailedAt).toEqual(expect.any(String));
    expect(firstGame.artifacts.lastIndexerTierDispatchError).toContain(
      "Failed to dispatch factory-torii-deployer workflow",
    );
    expect(secondGame.artifacts.pendingIndexerTierTarget).toBe("legendary");
    expect(secondGame.artifacts.pendingIndexerTierRequestedAt).toEqual(expect.any(String));
  });
});

describe("factory worker prize funding", () => {
  test("requires the admin secret for prize funding routes", async () => {
    let didCallGitHub = false;
    globalThis.fetch = async () => {
      didCallGitHub = true;
      throw new Error("Unauthorized requests should not reach GitHub");
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/runs/slot.blitz/bltz-prize-run/actions/fund-prize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: "250",
        }),
      }),
      buildWorkerEnv({ FACTORY_WORKER_ADMIN_SECRET: "factory-secret" }),
    );

    expect(response.status).toBe(401);
    expect(didCallGitHub).toBe(false);
  });

  test("dispatches series prize funding with only unfunded completed games by default", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });

      if (
        String(url).includes("/contents/runs/slot/blitz/series/bltz-weekend-cup.json") &&
        (!init?.method || init.method === "GET")
      ) {
        return buildGitHubContentsResponse({
          version: 1,
          kind: "series",
          runId: "slot.blitz:series:bltz-weekend-cup",
          environment: "slot.blitz",
          chain: "slot",
          gameType: "blitz",
          seriesName: "bltz-weekend-cup",
          status: "complete",
          executionMode: "fast_trial",
          requestedLaunchStep: "full",
          inputPath: "inputs/slot/blitz/series/bltz-weekend-cup/101-1.json",
          latestLaunchRequestId: "101-1",
          currentStepId: null,
          createdAt: offsetTimestamp(-60_000),
          updatedAt: offsetTimestamp(-30_000),
          workflow: {
            workflowName: "game-launch.yml",
          },
          autoRetry: {
            enabled: true,
            intervalMinutes: 15,
          },
          steps: [],
          summary: {
            environment: "slot.blitz",
            chain: "slot",
            gameType: "blitz",
            seriesName: "bltz-weekend-cup",
            rpcUrl: "https://rpc.example",
            factoryAddress: "0x123",
            autoRetryEnabled: true,
            autoRetryIntervalMinutes: 15,
            dryRun: false,
            configMode: "batched",
            seriesCreated: true,
            games: [
              {
                gameName: "bltz-weekend-cup-01",
                startTime: 1774195200,
                startTimeIso: "2026-03-22T16:00:00.000Z",
                durationSeconds: 3600,
                seriesGameNumber: 1,
                currentStepId: null,
                latestEvent: "Ready",
                status: "succeeded",
                artifacts: {
                  worldAddress: "0x111",
                },
              },
              {
                gameName: "bltz-weekend-cup-02",
                startTime: 1774198800,
                startTimeIso: "2026-03-22T17:00:00.000Z",
                durationSeconds: 3600,
                seriesGameNumber: 2,
                currentStepId: null,
                latestEvent: "Ready",
                status: "succeeded",
                artifacts: {
                  worldAddress: "0x222",
                  prizeFunding: {
                    transfers: [
                      {
                        id: "0xabc",
                        tokenAddress: "0x123",
                        amountRaw: "100",
                        amountDisplay: "1",
                        decimals: 18,
                        transactionHash: "0xabc",
                        fundedAt: "2026-03-18T11:00:00.000Z",
                      },
                    ],
                  },
                },
              },
              {
                gameName: "bltz-weekend-cup-03",
                startTime: 1774202400,
                startTimeIso: "2026-03-22T18:00:00.000Z",
                durationSeconds: 3600,
                seriesGameNumber: 3,
                currentStepId: "configure-worlds",
                latestEvent: "Configuring",
                status: "running",
                artifacts: {},
              },
            ],
          },
          artifacts: {
            summaryPath: ".context/game-launch/series-slot-blitz-bltz-weekend-cup.json",
            seriesCreated: true,
            seriesCreatedAt: "2026-03-18T10:00:00.000Z",
          },
        });
      }

      if (String(url).includes("/contents/inputs/slot/blitz/series/bltz-weekend-cup/101-1.json")) {
        return buildGitHubContentsResponse({
          environment: "slot.blitz",
          seriesName: "bltz-weekend-cup",
          request: {
            environmentId: "slot.blitz",
            seriesName: "bltz-weekend-cup",
            games: [
              { gameName: "bltz-weekend-cup-01", startTime: "2026-03-22T16:00:00.000Z" },
              { gameName: "bltz-weekend-cup-02", startTime: "2026-03-22T17:00:00.000Z" },
              { gameName: "bltz-weekend-cup-03", startTime: "2026-03-22T18:00:00.000Z" },
            ],
          },
        });
      }

      if (String(url).includes("/actions/workflows/factory-prize-funding.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${String(url)}`);
    };

    const response = await worker.fetch(
      new Request("https://worker.example/api/factory/series-runs/slot.blitz/bltz-weekend-cup/actions/fund-prize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-factory-admin-secret": "factory-secret",
        },
        body: JSON.stringify({
          amount: "250",
        }),
      }),
      buildWorkerEnv({ FACTORY_WORKER_ADMIN_SECRET: "factory-secret" }),
    );

    const dispatchCall = fetchCalls.find((call) =>
      call.url.includes("/actions/workflows/factory-prize-funding.yml/dispatches"),
    );
    const dispatchBody = JSON.parse(String(dispatchCall?.init?.body));

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs.run_kind).toBe("series");
    expect(dispatchBody.inputs.run_name).toBe("bltz-weekend-cup");
    expect(dispatchBody.inputs.prize_amount).toBe("250");
    expect(dispatchBody.inputs.selected_games_json).toBe(JSON.stringify(["bltz-weekend-cup-01"]));
  });
});

function buildWorkerEnv(overrides: Record<string, string> = {}) {
  return {
    GITHUB_TOKEN: "test-token",
    GITHUB_REPOSITORY: "bibliotheca/eternum",
    GITHUB_API_URL: "https://api.github.example",
    GITHUB_WORKFLOW_FILE: "game-launch.yml",
    GITHUB_WORKFLOW_REF: "next",
    FACTORY_RUN_STORE_BRANCH: "factory-runs",
    ...overrides,
  };
}

function buildGitHubContentsResponse(value: unknown) {
  return new Response(
    JSON.stringify({
      encoding: "base64",
      content: Buffer.from(JSON.stringify(value)).toString("base64"),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function buildGitHubDirectoryResponse(entries: unknown[]) {
  return new Response(JSON.stringify(entries), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function offsetTimestamp(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}
