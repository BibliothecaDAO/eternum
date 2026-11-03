import { afterEach, expect, it, vi } from "vitest";
import { watchReleaseMove } from "./stale-release.mjs";

afterEach(() => vi.unstubAllGlobals());

function setup(reply, receipt) {
  let listener;
  let nonceReads = 0;
  const stop = vi.fn();
  const devTools = {
    onEvent: (value) => {
      listener = value;
      return stop;
    },
    send: async () => ({ body: JSON.stringify(reply) }),
  };
  vi.stubGlobal("fetch", async (_url, options) => {
    const request = JSON.parse(options.body);
    expect(options.redirect).toBe("manual");
    return Response.json({
      result: request.method === "starknet_getNonce" ? (nonceReads++ === 0 || !receipt ? "0x7" : "0x8") : receipt,
    });
  });
  const watch = watchReleaseMove(devTools);
  listener({
    method: "Network.requestWillBeSent",
    params: {
      requestId: "move",
      request: {
        url: "https://node.test/rpc/v0_10_2",
        postData: JSON.stringify({
          method: "starknet_addInvokeTransaction",
          params: { invoke_transaction: { sender_address: "0x123", signature: ["private-evidence"], nonce: "0x7" } },
        }),
      },
    },
  });
  return {
    watch,
    stop,
    received: () => listener({ method: "Network.loadingFinished", params: { requestId: "move" } }),
  };
}

it("measures a refused submission with no inclusion, fee or consumed nonce", async () => {
  const run = setup({ error: { code: 55, data: "stale release" } });
  await run.watch.before();
  run.received();
  const measured = await run.watch.measure();
  expect(measured).toEqual({
    nonceBefore: "0x7",
    nonceAfter: "0x7",
    nonceSpent: "0",
    attempts: [{ nonce: "0x7", rpcErrorCode: 55, staleRelease: true, included: false, actualFee: "0" }],
  });
  expect(JSON.stringify(measured)).not.toContain("private-evidence");
  expect(JSON.stringify(measured)).not.toContain("0x123");
  run.watch.stop();
  expect(run.stop).toHaveBeenCalledOnce();
});

it("records an included revert's actual fee and consumed nonce", async () => {
  const run = setup(
    { result: { transaction_hash: "0xabc" } },
    {
      execution_status: "REVERTED",
      revert_reason: "stale release",
      actual_fee: { amount: "0x42", unit: "FRI" },
    },
  );
  await run.watch.before();
  run.received();
  expect(await run.watch.measure()).toMatchObject({
    nonceSpent: "1",
    attempts: [
      { transactionHash: "0xabc", execution: "REVERTED", staleRelease: true, actualFee: "0x42", feeUnit: "FRI" },
    ],
  });
  run.watch.stop();
});
