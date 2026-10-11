import { expect, test } from "bun:test";
import { RpcProvider, logger } from "starknet";
import { main, preparationSteps, type Deployment } from "./main";
import { confirm } from "./chain";
import { environments, type Inputs } from "./settings";
import { runSteps } from "./run";

test("startup disables the SDK logger through its own setting before any deployment work", async () => {
  const before = logger.getLogLevel();
  try {
    logger.setLogLevel("DEBUG");
    await expect(main([])).rejects.toThrow("Usage:");
    expect(logger.getLogLevel()).toBe("OFF");
    expect(logger.getEnabledLogLevels()).toEqual([]);
  } finally {
    logger.setLogLevel(before);
  }
});

test.each([false, true])("inspection announces itself before waiting, apply=%s", async (apply) => {
  const observed: string[] = [];
  let done = false;
  await runSteps(
    [
      {
        name: "Mainnet step",
        payer: "deployer",
        cost: "test",
        inspect: async () => {
          observed.push("inspect");
          return { done, detail: "test" };
        },
        apply: async () => {
          done = true;
        },
      },
    ],
    apply,
    (line) => observed.push(line),
  );
  expect(observed.slice(0, 2)).toEqual(["Checking Mainnet step.", "inspect"]);
});

test("the ledger step announces metadata reads through its output before any event scan", async () => {
  const lines: string[] = [];
  let scans = 0;
  const context = {
    target: environments.dev,
    keys: { monitor: "0x125" },
    assets: { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" },
    inputs: { blitzStart: "2027-01-01T00:00:00Z", blitzEnd: "2027-02-01T00:00:00Z" } as Inputs,
    output: (line: string) => lines.push(line),
    provider: {
      getBlockWithTxHashes: async () => ({ block_number: 50, timestamp: 100 }),
      getClassHashAt: async () => "0xabc",
      getEvents: async () => {
        expect(lines).toEqual(["Reading collectible metadata on mainnet."]);
        scans++;
        return { events: [] };
      },
      callContract: async ({ entrypoint }: { entrypoint: string }) => {
        if (entrypoint === "has_role") return ["1"];
        throw {
          code: 40,
          message: entrypoint === "get_preset" ? "Ledger: unknown preset" : "Ledger: unknown Blitz season",
        };
      },
    },
  } as unknown as Deployment;
  await preparationSteps(context)
    .find(({ name }) => name === "Ledger setup")!
    .inspect();
  expect(scans).toBe(10);
});

test("the installed SDK waits past pre-confirmation before confirm returns and latest is inspected", async () => {
  const observed: string[] = [];
  let statuses = 0;
  const provider = new RpcProvider({
    nodeUrl: "https://rpc.invalid",
    specVersion: "0.9.0",
    transactionRetryIntervalFallback: 1,
    baseFetch: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      let result: unknown;
      if (request.method === "starknet_getTransactionStatus") {
        observed.push("status");
        result = {
          finality_status: ++statuses === 1 ? "PRE_CONFIRMED" : "ACCEPTED_ON_L2",
          execution_status: "SUCCEEDED",
        };
      } else if (request.method === "starknet_getTransactionReceipt") {
        expect(statuses).toBe(2);
        observed.push("receipt");
        result = {
          transaction_hash: "0x123",
          type: "INVOKE",
          block_hash: "0x456",
          block_number: 50,
          finality_status: "ACCEPTED_ON_L2",
          execution_status: "SUCCEEDED",
          events: [],
          messages_sent: [],
        };
      } else if (request.method === "starknet_getBlockWithTxHashes") {
        expect(observed.at(-1)).toBe("confirmed");
        result = { block_number: 50, block_hash: "0x456", timestamp: 100, status: "ACCEPTED_ON_L2", transactions: [] };
      } else throw new Error("Unexpected test RPC method");
      return Response.json({ jsonrpc: "2.0", id: request.id, result });
    },
  });
  await confirm(provider, "0x123", (line) => observed.push(line));
  observed.push("confirmed");
  expect(await provider.getBlockWithTxHashes("latest")).toMatchObject({ block_number: 50 });
  expect(observed).toEqual(["Waiting for transaction confirmation.", "status", "status", "receipt", "confirmed"]);
});
