import { afterEach, describe, expect, it, mock } from "bun:test";
import { ec, hash, type RpcProvider } from "starknet";
import schema from "../../../../../contracts/l3/world-native/schema/schema.json";
import { completeNativeAdminCommand, executeNativeAdminCommand } from "./command";
import type { NativeWorldManifest } from "./types";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function setup(outcome?: string[]) {
  const receipt = {
    events: [
      { from_address: "0x77", keys: [hash.getSelectorFromName("BatchProgress"), "7"], data: ["291", "3", "0"] },
      {
        from_address: "0x77",
        keys: [hash.getSelectorFromName("ExecutionRecorded")],
        data: outcome ?? ["7", "291", "3", "1", "8", "1", "0"],
      },
    ],
  };
  const provider = {
    getChainId: mock(async () => "0x1"),
    callContract: mock(async () => ["1", "2", "4", "3", "5", "6", "1000"]),
    waitForTransaction: mock(async () => receipt),
  };
  let action = "";
  const requests: unknown[] = [];
  globalThis.fetch = mock(async (_url: unknown, options?: RequestInit) => {
    if (options?.method === "POST") {
      const signed = JSON.parse(String(options.body));
      requests.push(signed);
      action = hash.computePoseidonHashOnElements(signed.intent);
      expect(
        ec.starkCurve.verify(
          new ec.starkCurve.Signature(BigInt(signed.r), BigInt(signed.s)),
          action,
          ec.starkCurve.getPublicKey("0x1234"),
        ),
      ).toBe(true);
      return Response.json({ action, order: 7 + requests.length });
    }
    return Response.json({ action, order: 7 + requests.length, transaction_hash: "0x55" });
  }) as unknown as typeof fetch;
  const manifest = {
    native: {
      domains: { season: { address: "0x77" } },
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  } as unknown as NativeWorldManifest;
  const input = {
    provider: provider as unknown as RpcProvider,
    manifest,
    admissionUrl: "http://127.0.0.1:1",
    gameId: 7,
    accountAddress: "0x123",
    privateKey: "0x1234",
    command: { kind: "MarkGameSettled", value: undefined } as const,
  };
  return { input, provider, requests, receipt };
}
describe("native administrative command", () => {
  it("signs the compiled command and confirms its accepted outcome", async () => {
    const { input, provider, requests } = setup();
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "0" });
    expect(requests).toHaveLength(1);
    expect(provider.waitForTransaction).toHaveBeenCalledWith("0x55");
  });
  it("returns the remaining count for an incomplete administrative batch", async () => {
    const { input, receipt } = setup();
    receipt.events[0].data[2] = "1";
    expect(await executeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "1" });
  });
  it("completes administrative batches only after the final recorded count", async () => {
    const { input, receipt, provider, requests } = setup();
    let calls = 0;
    provider.callContract.mockImplementation(async () => ["1", "2", "4", String(3 + calls), "5", "6", "1000"]);
    provider.waitForTransaction.mockImplementation(async () => {
      receipt.events[0].data[1] = String(3 + calls);
      receipt.events[0].data[2] = calls === 0 ? "1" : "0";
      receipt.events[1].data[2] = String(3 + calls);
      receipt.events[1].data[4] = String(8 + calls++);
      return receipt;
    });
    expect(await completeNativeAdminCommand(input)).toEqual({ transactionHash: "0x55", remaining: "0" });
    expect(requests).toHaveLength(2);
  });
  it("refuses to infer completion from a successful receipt without progress", async () => {
    const { input, receipt } = setup();
    receipt.events.shift();
    await expect(completeNativeAdminCommand(input)).rejects.toThrow("no remaining count");
  });
  it("stops administrative work that cannot advance", async () => {
    const { input, receipt, requests, provider } = setup();
    let calls = 0;
    provider.callContract.mockImplementation(async () => ["1", "2", "4", String(3 + calls), "5", "6", "1000"]);
    provider.waitForTransaction.mockImplementation(async () => {
      receipt.events[0].data = ["291", String(3 + calls), "1"];
      receipt.events[1].data[2] = String(3 + calls);
      receipt.events[1].data[4] = String(8 + calls++);
      return receipt;
    });
    await expect(completeNativeAdminCommand(input)).rejects.toThrow("no progress");
    expect(requests).toHaveLength(2);
  });
  it("rejects a receipt for another ticket", async () => {
    const { input } = setup(["7", "291", "3", "1", "9", "1", "0"]);
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("does not match");
  });
  it("reports the recorded rejection reason", async () => {
    const { input } = setup(["7", "291", "3", "1", "8", "2", "77"]);
    await expect(executeNativeAdminCommand(input)).rejects.toThrow("Native command rejected: 77");
  });
  it("refuses a player command before reading admission", async () => {
    const { input, provider } = setup();
    await expect(
      executeNativeAdminCommand({ ...input, command: { kind: "Explore", value: { explorer_id: 1, direction: 0 } } }),
    ).rejects.toThrow("Not an administrative");
    expect(provider.callContract).not.toHaveBeenCalled();
  });
});
