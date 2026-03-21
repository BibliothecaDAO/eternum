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
