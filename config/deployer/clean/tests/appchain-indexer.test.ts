import { describe, expect, test } from "bun:test";

import {
  appendWorldToConfig,
  configContainsWorld,
  createAppchainIndexer,
  type AppchainIndexerOptions,
} from "../indexing/appchain-indexer";
import type { IndexerRequest } from "../types";

const REQUEST: IndexerRequest = {
  env: "appchain",
  rpcUrl: "https://katana.example",
  namespaces: "s1_eternum",
  worldName: "bltz-hot-add",
  worldAddress: "0xabc",
};

const BASE_CONFIG = `rpc = "https://katana.example"

[indexing]
contracts = [
  "WORLD:0x123",
]
`;

describe("appchain indexer", () => {
  test("persists and hot-adds a world without redeploying ECS", async () => {
    const awsCalls: string[][] = [];
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    let writtenConfig = "";
    let statusChecks = 0;
    const clock = createClock();

    const result = await createAppchainIndexer(REQUEST, {
      ...clock.options,
      awsCommand: async (args) => {
        awsCalls.push(args);
        if (args[0] === "ssm" && args[1] === "get-parameter") return BASE_CONFIG;
        if (args[0] === "ssm" && args[1] === "put-parameter") {
          writtenConfig = args[args.indexOf("--value") + 1];
          return "";
        }
        if (args[0] === "secretsmanager") return "management-token";
        throw new Error(`Unexpected AWS command: ${args.join(" ")}`);
      },
      fetchImpl: async (input, init) => {
        const url = String(input);
        fetchCalls.push({ url, init });
        if (init?.method === "POST") {
          return Response.json({ success: true, outcome: "registered", target_head: 100 });
        }

        statusChecks += 1;
        return Response.json({
          success: true,
          contract: {
            address: "0xabc",
            contract_type: "WORLD",
            head: statusChecks === 1 ? 99 : 100,
            chain_head: 100,
            ready: statusChecks > 1,
          },
        });
      },
      toriiUrl: "https://torii.example/",
    });

    expect(result).toEqual({ mode: "github-actions", action: "created" });
    expect(configContainsWorld(writtenConfig, REQUEST.worldAddress)).toBe(true);
    expect(awsCalls.some((args) => args.includes("update-service"))).toBe(false);
    expect(fetchCalls.map((call) => call.init?.method)).toEqual(["POST", "GET", "GET"]);
    expect(fetchCalls[0].url).toBe("https://torii.example/admin/indexing/contracts");
    expect(new Headers(fetchCalls[0].init?.headers).get("authorization")).toBe("Bearer management-token");
  });

  test("repairs runtime state when SSM already contains the world", async () => {
    const awsCalls: string[][] = [];
    const result = await createAppchainIndexer(REQUEST, {
      ...createClock().options,
      awsCommand: async (args) => {
        awsCalls.push(args);
        if (args[0] === "ssm") return appendWorldToConfig(BASE_CONFIG, REQUEST.worldAddress);
        return "management-token";
      },
      fetchImpl: async (_input, init) =>
        init?.method === "POST"
          ? Response.json({ success: true, outcome: "registered", target_head: 100 })
          : readyStatusResponse(),
    });

    expect(result.action).toBe("created");
    expect(awsCalls.filter((args) => args[0] === "ssm")).toHaveLength(1);
  });

  test("reports already-live only when durable and runtime state already exist", async () => {
    const result = await createAppchainIndexer(REQUEST, {
      ...createClock().options,
      awsCommand: async (args) =>
        args[0] === "ssm" ? appendWorldToConfig(BASE_CONFIG, REQUEST.worldAddress) : "management-token",
      fetchImpl: async (_input, init) =>
        init?.method === "POST"
          ? Response.json({ success: true, outcome: "already_registered", target_head: 100 })
          : readyStatusResponse(),
    });

    expect(result.action).toBe("already-live");
  });

  test("fails with cursor context when the world does not become ready", async () => {
    const clock = createClock();
    await expect(
      createAppchainIndexer(REQUEST, {
        ...clock.options,
        indexingTimeoutMs: 5_000,
        indexingPollMs: 1_000,
        awsCommand: async (args) => (args[0] === "ssm" ? BASE_CONFIG : "management-token"),
        fetchImpl: async (_input, init) =>
          init?.method === "POST"
            ? Response.json({ success: true, outcome: "registered", target_head: 100 })
            : Response.json({
                success: true,
                contract: {
                  address: "0xabc",
                  contract_type: "WORLD",
                  head: 90,
                  chain_head: 100,
                  ready: false,
                },
              }),
      }),
    ).rejects.toThrow("cursor 90, chain head 100");
  });
});

function readyStatusResponse(): Response {
  return Response.json({
    success: true,
    contract: {
      address: "0xabc",
      contract_type: "WORLD",
      head: 100,
      chain_head: 100,
      ready: true,
    },
  });
}

function createClock(): { options: Pick<AppchainIndexerOptions, "now" | "sleep"> } {
  let now = 0;
  return {
    options: {
      now: () => now,
      sleep: async (durationMs) => {
        now += durationMs;
      },
    },
  };
}
