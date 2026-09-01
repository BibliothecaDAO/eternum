import { afterEach, describe, expect, test } from "bun:test";
import worker from "../run-store/cloudflare-worker.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("factory worker registrar workflows", () => {
  test("dispatches an appchain game with supported launch options", async () => {
    const calls = installGitHubFetch(({ url }) => {
      if (url.includes("/contents/runs/appchain/blitz/bltz-worker-test.json")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/runs", {
        environment: "appchain.blitz",
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
      environment: "appchain.blitz",
      launch_step: "full",
      game_name: "bltz-worker-test",
    });
    expect(launchOptions).toMatchObject({
      twoPlayerMode: true,
      biomeClimateOverrides: { elevationScaleBps: 12_000, moistureSeed: 991 },
      blitzRegistrationOverrides: { registration_count_max: 12 },
    });
  });

  test("echoes one exact allowed origin", async () => {
    installGitHubFetch(({ url }) => {
      if (url.includes("/contents/runs/appchain/blitz/bltz-cors.json")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const response = await worker.fetch(
      buildJsonRequest(
        "/api/factory/runs",
        {
          environment: "appchain.blitz",
          gameName: "bltz-cors",
          gameStartTime: "2099-01-01T00:00:00Z",
        },
        { Origin: "https://play.realms.party" },
      ),
      buildWorkerEnv({
        FACTORY_ALLOWED_ORIGINS: "https://play.realms.party, https://eternum-game.pages.dev",
      }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://play.realms.party");
  });

  test("rejects a browser origin outside the allowlist before touching GitHub", async () => {
    const calls = installGitHubFetch(() => {
      throw new Error("GitHub should not be called");
    });

    const response = await worker.fetch(
      buildJsonRequest(
        "/api/factory/runs",
        {
          environment: "appchain.blitz",
          gameName: "bltz-cors-rejected",
          gameStartTime: "2099-01-01T00:00:00Z",
        },
        { Origin: "https://attacker.example" },
      ),
      buildWorkerEnv({ FACTORY_ALLOWED_ORIGINS: "https://play.realms.party" }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await response.json()).toEqual({ error: "Origin is not allowed" });
    expect(calls).toHaveLength(0);
  });

  test("dispatches configured rotation YAML files during scheduled maintenance", async () => {
    const calls = installGitHubFetch(({ url }) => {
      if (url.includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      if (url.includes("/contents/indexes/")) {
        return new Response("Not Found", { status: 404 });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    const configPath = "config/deployer/clean/launch-configs/appchain-blitz-herald.yaml";

    await runScheduledWorker(
      buildWorkerEnv({
        FACTORY_ROTATION_CONFIGS: `${configPath}, ${configPath}`,
      }),
    );

    const dispatches = calls.filter((call) => call.url.includes("/actions/workflows/game-launch.yml/dispatches"));
    expect(dispatches).toHaveLength(1);
    expect(JSON.parse(String(dispatches[0]?.init?.body))).toEqual({
      ref: "next",
      inputs: {
        launch_kind: "rotation",
        environment: "appchain.blitz",
        launch_step: "full",
        config_path: configPath,
        auto_retry_enabled: "true",
      },
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

  test("rejects Madara now that its launches are box-native", async () => {
    const calls = installGitHubFetch(() => {
      throw new Error("GitHub should not be called");
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/runs", {
        environment: "madara.blitz",
        gameName: "bltz-box-only",
        gameStartTime: "2099-01-01T00:00:00Z",
      }),
      buildWorkerEnv(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unsupported environment "madara.blitz"' });
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
      environment: "appchain.blitz",
      gameName: "bltz-worker-test",
      workflow: { ref: "feat/madara-lab" },
      request: {
        environmentId: "appchain.blitz",
        gameName: "bltz-worker-test",
        startTime: "2099-01-01T00:00:00Z",
      },
    };
    const calls = installGitHubFetch(({ url }) => {
      if (url.includes("/contents/runs/appchain/blitz/bltz-worker-test.json")) {
        return buildGitHubContentsResponse(run);
      }
      if (url.includes("/contents/inputs/appchain/blitz/bltz-worker-test/101-1.json")) {
        return buildGitHubContentsResponse(input);
      }
      if (url.includes("/actions/workflows/game-launch.yml/dispatches")) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const response = await worker.fetch(
      buildJsonRequest("/api/factory/runs/appchain.blitz/bltz-worker-test/actions/continue", {}),
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

async function runScheduledWorker(env: Record<string, string>) {
  let scheduledTask: Promise<unknown> | undefined;
  worker.scheduled({}, env, {
    waitUntil(task: Promise<unknown>) {
      scheduledTask = task;
    },
  });
  if (!scheduledTask) throw new Error("Worker did not register scheduled maintenance");
  await scheduledTask;
}

function buildGameRun({ waitStatus }: { waitStatus: "failed" | "succeeded" }) {
  return {
    version: 1,
    kind: "game",
    environment: "appchain.blitz",
    gameName: "bltz-worker-test",
    status: waitStatus === "succeeded" ? "complete" : "attention",
    inputPath: "inputs/appchain/blitz/bltz-worker-test/101-1.json",
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
