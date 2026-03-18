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
      }),
    );
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
      }),
    );
  });
});

function buildWorkerEnv() {
  return {
    GITHUB_TOKEN: "test-token",
    GITHUB_REPOSITORY: "bibliotheca/eternum",
    GITHUB_API_URL: "https://api.github.example",
    GITHUB_WORKFLOW_FILE: "game-launch.yml",
    GITHUB_WORKFLOW_REF: "next",
    FACTORY_RUN_STORE_BRANCH: "factory-runs",
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
