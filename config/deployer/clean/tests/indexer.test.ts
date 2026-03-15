import { afterEach, describe, expect, test } from "bun:test";
import { createIndexer } from "../indexer";

const ENV_KEYS = [
  "GITHUB_ACTIONS",
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "GITHUB_API_URL",
  "GITHUB_REF_NAME",
  "GITHUB_SHA",
] as const;

const originalEnv = new Map<string, string | undefined>(ENV_KEYS.map((key) => [key, process.env[key]]));

function clearGitHubEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("createIndexer", () => {
  test("rejects missing GitHub workflow dispatch context", async () => {
    clearGitHubEnv();

    await expect(
      createIndexer(
        {
          env: "slot",
          rpcUrl: "https://rpc.example",
          namespaces: "s1_eternum",
          worldName: "bltz-fire-gate-42",
          worldAddress: "0x123",
        },
        {
          commandRunner: () => null,
        },
      ),
    ).rejects.toThrow(
      "Indexer creation requires direct GitHub workflow dispatch. Set GITHUB_TOKEN and GITHUB_REPOSITORY, and provide a ref via --ref or GITHUB_REF_NAME when not running inside GitHub Actions.",
    );
  });

  test("uses gh and git fallbacks locally when explicit GitHub env is missing", async () => {
    clearGitHubEnv();

    const progressMessages: string[] = [];
    let dispatchId = "";

    const commandRunner = (command: string, args: string[]) => {
      if (command === "gh" && args.join(" ") === "auth token") {
        return "gh-token";
      }

      if (command === "gh" && args.join(" ") === "repo view --json nameWithOwner --jq .nameWithOwner") {
        return "bibliotheca/eternum";
      }

      if (command === "git" && args.join(" ") === "branch --show-current") {
        return "credence0x/clean-ci-game-launch";
      }

      return null;
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);

      if (url.endsWith("/dispatches")) {
        const body = JSON.parse(String(init?.body || "{}")) as {
          ref: string;
          inputs: Record<string, string>;
        };
        dispatchId = body.inputs.launch_request_id;
        expect(body.ref).toBe("credence0x/clean-ci-game-launch");
        return new Response(null, { status: 204 });
      }

      if (url.includes("/actions/workflows/factory-torii-deployer.yml/runs?")) {
        return Response.json({
          workflow_runs: [
            {
              id: 100,
              run_number: 18,
              html_url: "https://github.example/bibliotheca/eternum/actions/runs/100",
              status: "queued",
              conclusion: null,
              event: "workflow_dispatch",
              head_branch: "credence0x/clean-ci-game-launch",
              head_sha: "",
              created_at: new Date().toISOString(),
              display_title: `Factory Torii Deployer / slot / bltz-fire-gate-42 / ${dispatchId}`,
            },
          ],
        });
      }

      if (url.endsWith("/actions/runs/100")) {
        return Response.json({
          id: 100,
          run_number: 18,
          html_url: "https://github.example/bibliotheca/eternum/actions/runs/100",
          status: "completed",
          conclusion: "success",
          event: "workflow_dispatch",
          head_branch: "credence0x/clean-ci-game-launch",
          head_sha: "",
          created_at: new Date().toISOString(),
          display_title: `Factory Torii Deployer / slot / bltz-fire-gate-42 / ${dispatchId}`,
        });
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    };

    const result = await createIndexer(
      {
        env: "slot",
        rpcUrl: "https://rpc.example",
        namespaces: "s1_eternum",
        worldName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      },
      {
        commandRunner,
        fetchImpl,
        sleep: async () => {},
        onProgress: (message) => progressMessages.push(message),
      },
    );

    expect(result.mode).toBe("github-actions");
    expect(progressMessages).toContain("Using GitHub token from gh auth token because GITHUB_TOKEN is not set");
    expect(progressMessages).toContain(
      "Using GitHub repository from gh repo view because GITHUB_REPOSITORY is not set",
    );
    expect(progressMessages).toContain("Using current git branch as workflow ref because no explicit ref was provided");
  });

  test("waits for the direct GitHub Actions workflow run to complete in CI", async () => {
    clearGitHubEnv();
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "bibliotheca/eternum";
    process.env.GITHUB_API_URL = "https://api.github.example";
    process.env.GITHUB_REF_NAME = "credence0x/clean-ci-game-launch";
    process.env.GITHUB_SHA = "deadbeef";

    const progressMessages: string[] = [];
    let dispatchId = "";

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);

      if (url.endsWith("/dispatches")) {
        const body = JSON.parse(String(init?.body || "{}")) as {
          ref: string;
          inputs: Record<string, string>;
        };
        dispatchId = body.inputs.launch_request_id;
        expect(body.ref).toBe("credence0x/clean-ci-game-launch");
        expect(body.inputs.env).toBe("slot");
        expect(body.inputs.torii_prefix).toBe("bltz-fire-gate-42");
        expect(body.inputs.rpc_url).toBe("https://rpc.example");
        expect(body.inputs.torii_world_address).toBe("0x123");
        expect(body.inputs.torii_namespaces).toBe("s1_eternum");
        return new Response(null, { status: 204 });
      }

      if (url.includes("/actions/workflows/factory-torii-deployer.yml/runs?")) {
        return Response.json({
          workflow_runs: [
            {
              id: 99,
              run_number: 17,
              html_url: "https://github.example/bibliotheca/eternum/actions/runs/99",
              status: "queued",
              conclusion: null,
              event: "workflow_dispatch",
              head_branch: "credence0x/clean-ci-game-launch",
              head_sha: "deadbeef",
              created_at: new Date().toISOString(),
              display_title: `Factory Torii Deployer / slot / bltz-fire-gate-42 / ${dispatchId}`,
            },
          ],
        });
      }

      if (url.endsWith("/actions/runs/99")) {
        return Response.json({
          id: 99,
          run_number: 17,
          html_url: "https://github.example/bibliotheca/eternum/actions/runs/99",
          status: "completed",
          conclusion: "success",
          event: "workflow_dispatch",
          head_branch: "credence0x/clean-ci-game-launch",
          head_sha: "deadbeef",
          created_at: new Date().toISOString(),
          display_title: `Factory Torii Deployer / slot / bltz-fire-gate-42 / ${dispatchId}`,
        });
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    };

    const result = await createIndexer(
      {
        env: "slot",
        rpcUrl: "https://rpc.example",
        namespaces: "s1_eternum",
        worldName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      },
      {
        fetchImpl,
        sleep: async () => {},
        onProgress: (message) => progressMessages.push(message),
      },
    );

    expect(result.mode).toBe("github-actions");
    expect(result.workflowRun).toEqual({
      workflowFile: "factory-torii-deployer.yml",
      ref: "credence0x/clean-ci-game-launch",
      runId: 99,
      runNumber: 17,
      htmlUrl: "https://github.example/bibliotheca/eternum/actions/runs/99",
      status: "completed",
      conclusion: "success",
    });
    expect(progressMessages).toContain("Waiting for factory-torii-deployer.yml run to appear");
    expect(progressMessages).toContain(
      "Tracking factory-torii-deployer.yml run #17: https://github.example/bibliotheca/eternum/actions/runs/99",
    );
  });
});
