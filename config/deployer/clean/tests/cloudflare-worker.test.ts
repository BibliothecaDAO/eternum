import { afterEach, describe, expect, test } from "bun:test";
import worker from "../run-store/cloudflare-worker.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("factory worker registrar workflows", () => {
  test("dispatches a Madara game with supported launch options", async () => {
    const calls = installGitHubFetch(({ url }) => {
      if (url.includes("/contents/runs/madara/blitz/bltz-worker-test.json")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/runs", {
        environment: "madara.blitz",
        gameName: "bltz-worker-test",
        gameStartTime: "2099-01-01T00:00:00Z",
        twoPlayerMode: true,
        biomeClimateOverrides: { elevationScaleBps: 12_000, moistureSeed: 991 },
        blitzRegistrationOverrides: { registration_count_max: 12 },
      }),
      buildWorkerEnv(),
    );

    const dispatch = calls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatch?.init?.body)) as {
      inputs: Record<string, string>;
    };
    const launchOptions = JSON.parse(dispatchBody.inputs.launch_options_json);

    expect(response.status).toBe(202);
    expect(dispatchBody.inputs).toMatchObject({
      launch_kind: "game",
      environment: "madara.blitz",
      launch_step: "full",
      game_name: "bltz-worker-test",
    });
    expect(launchOptions).toMatchObject({
      twoPlayerMode: true,
      biomeClimateOverrides: { elevationScaleBps: 12_000, moistureSeed: 991 },
      blitzRegistrationOverrides: { registration_count_max: 12 },
    });
  });

  test("rejects retired public-chain environments before touching GitHub", async () => {
    const calls = installGitHubFetch(() => {
      throw new Error("GitHub should not be called");
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/runs", {
        environment: "mainnet.blitz",
        gameName: "bltz-retired",
        gameStartTime: "2099-01-01T00:00:00Z",
      }),
      buildWorkerEnv(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unsupported environment "mainnet.blitz"' });
    expect(calls).toHaveLength(0);
  });

  test("does not expose the retired per-game indexer route", async () => {
    const calls = installGitHubFetch(() => {
      throw new Error("GitHub should not be called");
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/indexers/appchain.blitz/bltz-worker-test", {}),
      buildWorkerEnv(),
    );

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  test("continues a failed game at its GameRegistry wait", async () => {
    const run = buildGameRun({ waitStatus: "failed" });
    const input = {
      environment: "madara.blitz",
      gameName: "bltz-worker-test",
      workflow: { ref: "feat/madara-lab" },
      request: {
        environmentId: "madara.blitz",
        gameName: "bltz-worker-test",
        startTime: "2099-01-01T00:00:00Z",
      },
    };
    const calls = installGitHubFetch(({ url }) => {
      if (url.includes("/contents/runs/madara/blitz/bltz-worker-test.json")) {
        return buildGitHubContentsResponse(run);
      }
      if (url.includes("/contents/inputs/madara/blitz/bltz-worker-test/101-1.json")) {
        return buildGitHubContentsResponse(input);
      }
      if (url.includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/runs/madara.blitz/bltz-worker-test/actions/continue", {}),
      buildWorkerEnv(),
    );
    const dispatch = calls.find((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    const dispatchBody = JSON.parse(String(dispatch?.init?.body)) as { ref: string; inputs: Record<string, string> };

    expect(response.status).toBe(202);
    expect(dispatchBody.ref).toBe("feat/madara-lab");
    expect(dispatchBody.inputs.launch_step).toBe("wait-for-factory-index");
  });
});

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function installGitHubFetch(respond: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof fetch;
  return calls;
}

function buildJsonRequest(pathname: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://worker.example${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

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

function buildGameRun({ waitStatus }: { waitStatus: "failed" | "succeeded" }) {
  return {
    version: 1,
    kind: "game",
    environment: "madara.blitz",
    gameName: "bltz-worker-test",
    status: waitStatus === "succeeded" ? "complete" : "attention",
    inputPath: "inputs/madara/blitz/bltz-worker-test/101-1.json",
    currentStepId: waitStatus === "succeeded" ? null : "wait-for-factory-index",
    updatedAt: "2000-01-01T00:00:00.000Z",
    workflow: { ref: "feat/madara-lab" },
    steps: [
      { id: "create-world", status: "succeeded" },
      { id: "wait-for-factory-index", status: waitStatus },
    ],
    artifacts: { worldAddress: "0xworld" },
  };
}

function buildGitHubContentsResponse(value: unknown) {
  return Response.json({
    sha: "test-sha",
    encoding: "base64",
    content: Buffer.from(JSON.stringify(value)).toString("base64"),
  });
}
