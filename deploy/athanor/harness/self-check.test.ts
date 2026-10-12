import { EventEmitter } from "node:events";
import { byteArray, CallData, hash, shortString } from "starknet";
import { HarnessProvider } from "./provider";
import { localSelfCheckRoutes } from "./self-check-routes";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { runSelfCheck, type DeploymentCheckPort } from "./self-check";

test("a short route plan cannot pass the deployment listing gate", async () => {
  let disposed = false;
  const result = await runSelfCheck(
    {
      createThrowawayGame: async () => ({
        gameId: 7,
        routes: [],
        dispose() {
          disposed = true;
        },
      }),
    },
    100,
  );
  expect(result).toMatchObject({ passed: false, firstFailedRoute: "CreateExplorer", completed: [], gameId: 7 });
  expect(disposed).toBe(true);
  expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
});
test("launcher setup timeout names the first failed route without exposing its exception", async () => {
  const result = await runSelfCheck({ createThrowawayGame: () => new Promise(() => {}) }, 10);
  expect(result.firstFailedRoute).toBe("create_throwaway_game");
  expect(result.passed).toBe(false);
  expect(result.failure).toEqual({ category: "timeout" });
});
test("even complete coverage refuses a route with the wrong game scope", async () => {
  const port = {
    createThrowawayGame: async () => ({
      gameId: 7,
      routes: Object.keys(nativeCommandBits).map((route) => ({ route, client: { gameId: 8 } })),
      dispose() {},
    }),
  } as unknown as DeploymentCheckPort;
  const result = await runSelfCheck(port, 100);
  expect(result).toMatchObject({ passed: false, firstFailedRoute: "CreateExplorer", completed: [] });
});
test("fixture failure emits only route and timing evidence", async () => {
  const result = await runSelfCheck(
    {
      createThrowawayGame: async () => {
        throw new Error("private setup input");
      },
    },
    100,
  );
  expect(JSON.stringify(result)).not.toContain("private setup input");
  expect(result.failure).toEqual({ category: "other" });
});

afterEach(() => mock.restore());
const TX = "0x123";
const publicReason = "insufficient stamina, you need: 30, and have: 20";
function rejectedReceipt(actor = "0x10") {
  return {
    execution_status: "SUCCEEDED",
    block_number: 121,
    events: [
      {
        from_address: "0x20",
        keys: [hash.getSelectorFromName("GameplayRejected"), "1", "7", actor, TX],
        data: [
          shortString.encodeShortString("GAMEPLAY_REJECTED"),
          ...CallData.compile(byteArray.byteArrayFromString(publicReason)),
        ],
      },
    ],
  };
}
function routePort(outcome: "SUCCEEDED" | "REJECTED" | "transport", verify = () => {}) {
  const provider = Object.assign(new EventEmitter(), {
    submitCommand: async () => {
      provider.emit("transactionSubmitted", { signerAddress: "0x10", transactionHash: TX });
    },
  });
  const client = {
    gameId: 7,
    shard: { rpcUrl: "http://127.0.0.1:1", worldAddress: "0x20" },
    setup: { network: { provider }, store: {} },
    waitForAction: async () => {
      if (outcome === "transport") throw new Error("private transport input");
      return { status: outcome, revertReason: "private exception input" };
    },
  };
  return {
    createThrowawayGame: async () => ({
      gameId: 7,
      dispose() {},
      routes: ["Explore", ...localSelfCheckRoutes.filter((route) => route !== "Explore")].map((route) => ({
        route,
        client,
        account: { address: "0x10" },
        command: () => ({ kind: route }),
        verify,
      })),
    }),
  } as unknown as DeploymentCheckPort;
}

test("an unexpected domain refusal records only the receipt's public reason and transaction hash", async () => {
  spyOn(HarnessProvider.prototype, "getTransactionReceipt").mockResolvedValue(rejectedReceipt() as never);
  const result = await runSelfCheck(routePort("REJECTED"));
  expect(result).toMatchObject({
    passed: false,
    firstFailedRoute: "Explore",
    completed: [],
    failure: { category: "refused", transactionHash: TX, reason: publicReason },
  });
  expect(JSON.stringify(result)).not.toContain("private exception input");
});

test.each([
  { execution_status: "REVERTED", block_number: 121, revert_reason: "private receipt diagnostic" },
  rejectedReceipt("0x99"),
])("only a GameplayRejected event matching this action supplies public details", async (receipt) => {
  spyOn(HarnessProvider.prototype, "getTransactionReceipt").mockResolvedValue(receipt as never);
  const result = await runSelfCheck(routePort("REJECTED"));
  expect(result.failure).toEqual({ category: "other" });
});

test("verification failure records a fixed category, not the assertion text", async () => {
  const result = await runSelfCheck(
    routePort("SUCCEEDED", () => {
      throw new Error("private assertion input");
    }),
  );
  expect(result.failure).toEqual({ category: "verify" });
  expect(JSON.stringify(result)).not.toContain("private assertion input");
});

test("transport failure carries no exception text or unproven refusal", async () => {
  spyOn(HarnessProvider.prototype, "getTransactionReceipt").mockResolvedValue({
    execution_status: "SUCCEEDED",
    block_number: 121,
  } as never);
  const result = await runSelfCheck(routePort("transport"));
  expect(result.failure).toEqual({ category: "other" });
  expect(JSON.stringify(result)).not.toContain("private transport input");
});
