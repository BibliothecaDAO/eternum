import { afterEach, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Account, Call } from "starknet";
import { send, transactionIntentName } from "./chain";
import { configureLedger } from "./ledger";
import { PrivateStore } from "./private-store";
import { environments, type Inputs } from "./settings";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function store() {
  const base = mkdtempSync(join(tmpdir(), "transaction-recovery-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  return new PrivateStore(join(base, "private"), join(base, "repo"), true);
}
const desired: Call[] = [{ contractAddress: "0x1", entrypoint: "transfer", calldata: ["2", "30", "0"] }];
const tampered: Call[] = [{ contractAddress: "0xbad", entrypoint: "transfer", calldata: ["999", "99", "0"] }];
function account() {
  return {
    address: "0x100",
    getNonce: mock(async (_block: number) => "12"),
    execute: mock(async (_calls: Call[], _options: { nonce: string }) => ({ transaction_hash: "0xabc" })),
    waitForTransaction: mock(async (_hash: string, _options?: unknown) => ({ execution_status: "SUCCEEDED" })),
    getTransactionReceipt: mock(async (_hash: string) => ({
      execution_status: "SUCCEEDED",
      finality_status: "ACCEPTED_ON_L2",
    })),
  };
}
test.each(["7", "12"])(
  "an unsent intent uses the unconsumed nonce (current=%s), never saved calls",
  async (current) => {
    const files = store();
    const rpc = account();
    rpc.getNonce.mockResolvedValue(current);
    files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", calls: tampered });
    await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
    expect(rpc.execute).toHaveBeenCalledWith(desired, { nonce: current });
    expect(rpc.getNonce.mock.calls).toEqual([[5]]);
    expect(files.read<{ nonce: string; hash: string }>(transactionIntentName(rpc, desired, "pay"))).toEqual({
      nonce: current,
      hash: "0xabc",
    });
  },
);
test("a saved hash for the same intent is awaited and a successful receipt is never resent", async () => {
  const files = store();
  const rpc = account();
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", calls: tampered, hash: "0xold" });
  await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
  expect(rpc.waitForTransaction).toHaveBeenCalledWith("0xold", { retries: 30, retryInterval: 1000 });
  expect(rpc.execute).not.toHaveBeenCalled();
  expect(rpc.getNonce).not.toHaveBeenCalled();
});
test("a reverted receipt permits new calls at the current nonce", async () => {
  const files = store();
  const rpc = account();
  rpc.waitForTransaction.mockImplementation(async (hash) => ({
    execution_status: hash === "0xold" ? "REVERTED" : "SUCCEEDED",
  }));
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", calls: tampered, hash: "0xold" });
  await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
  expect(rpc.execute).toHaveBeenCalledWith(desired, { nonce: "12" });
});
test("a dropped hash is awaited, checked again, then retries fresh calls at the saved nonce", async () => {
  const files = store();
  const rpc = account();
  const events: string[] = [];
  rpc.waitForTransaction.mockImplementation(async (hash) => {
    events.push(`wait:${hash}`);
    if (hash === "0xold") throw new Error("waitForTransaction timed-out with retries 30");
    return { execution_status: "SUCCEEDED" };
  });
  rpc.getTransactionReceipt.mockImplementation(async () => {
    events.push("receipt");
    throw { code: 29, message: "Transaction hash not found" };
  });
  rpc.execute.mockImplementation(async () => {
    events.push("send");
    return { transaction_hash: "0xabc" };
  });
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", calls: tampered, hash: "0xold" });
  await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
  expect(events).toEqual(["wait:0xold", "receipt", "send", "wait:0xabc"]);
  expect(rpc.execute).toHaveBeenCalledWith(desired, { nonce: "7" });
  expect(rpc.getNonce).not.toHaveBeenCalled();
});
test("a receipt found after the wait is not resent", async () => {
  const files = store();
  const rpc = account();
  rpc.waitForTransaction.mockImplementation(async () => {
    throw { code: 29 };
  });
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", calls: tampered, hash: "0xold" });
  await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
  expect(rpc.getTransactionReceipt).toHaveBeenCalledWith("0xold");
  expect(rpc.execute).not.toHaveBeenCalled();
});
test.each(["wait", "receipt"])("an unrelated %s failure never authorizes a resend", async (where) => {
  const files = store();
  const rpc = account();
  rpc.waitForTransaction.mockImplementation(async () => {
    throw where === "wait" ? { code: 429 } : { code: 29 };
  });
  rpc.getTransactionReceipt.mockImplementation(async () => {
    throw { code: 429 };
  });
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", calls: tampered, hash: "0xold" });
  await expect(send(rpc as unknown as Account, desired, files, "pay", () => {}, 5)).rejects.toEqual({ code: 429 });
  expect(rpc.execute).not.toHaveBeenCalled();
});
test("changing unsent Blitz dates sends the newly computed setup with the current nonce", async () => {
  const files = store();
  const rpc = account();
  files.write("transaction-setup.json", { nonce: "7", calls: tampered });
  const input = {
    blitzStart: "2027-01-01T00:00:00Z",
    blitzEnd: "2027-02-01T00:00:00Z",
    frontierPresetId: "6",
  } as Inputs;
  const provider = {
    ...rpc,
    getBlockWithTxHashes: async () => ({ block_number: 5, timestamp: 1 }),
    getEvents: async () => ({ events: [] }),
    getClassHashAt: async () => "0x1",
    callContract: async ({ entrypoint }: { entrypoint: string }) => {
      if (entrypoint === "has_role") return ["1"];
      throw {
        code: 40,
        message: "Contract error",
        data: { revert_error: entrypoint === "get_preset" ? "Ledger: unknown preset" : "Ledger: unknown Blitz season" },
      };
    },
  } as unknown as Account;
  const assets = { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" };
  await configureLedger(provider, environments.dev, assets, "0x33", input, files, () => {});
  const [calls, options] = rpc.execute.mock.calls[0]!;
  expect(options).toEqual({ nonce: "12" });
  expect(rpc.getNonce.mock.calls).toEqual([[5]]);
  expect(calls.find((call) => call.entrypoint === "open_season")!.calldata).toEqual([
    "1",
    "1",
    String(Date.parse(input.blitzStart!) / 1000),
    String(Date.parse(input.blitzEnd!) / 1000),
  ]);
  expect(calls.some((call) => call.contractAddress === "0xbad")).toBe(false);
});

test("a pre-confirmed receipt recovered after a timed-out wait is still pending and never resent", async () => {
  const files = store();
  const rpc = account();
  rpc.waitForTransaction.mockImplementation(async () => {
    throw new Error("waitForTransaction timed-out with retries 30");
  });
  rpc.getTransactionReceipt.mockResolvedValue({ execution_status: "SUCCEEDED", finality_status: "PRE_CONFIRMED" });
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7", hash: "0xold" });
  const output = mock(() => {});
  await expect(send(rpc as unknown as Account, desired, files, "pay", output, 5)).rejects.toThrow("still pending");
  expect(rpc.execute).not.toHaveBeenCalled();
  expect(output).toHaveBeenCalledWith("Waiting for transaction confirmation.");
});

test.each([false, true])(
  "a different call set never inherits another intent's nonce or receipt (sent=%s)",
  async (sent) => {
    const files = store();
    const rpc = account();
    files.write(transactionIntentName(rpc, tampered, "pay"), { nonce: "7", ...(sent ? { hash: "0xold" } : {}) });
    await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
    expect(rpc.execute).toHaveBeenCalledWith(desired, { nonce: "12" });
    expect(rpc.waitForTransaction).not.toHaveBeenCalledWith("0xold", expect.anything());
  },
);
test("a succeeded intent belongs to its payer even when calls are identical", async () => {
  const files = store();
  const rpc = account();
  files.write(transactionIntentName({ address: "0x200" }, desired, "pay"), { nonce: "7", hash: "0xold" });
  await send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
  expect(rpc.execute).toHaveBeenCalledWith(desired, { nonce: "12" });
});

test.each([false, true])("an unsent intent recovers when the other operation lands first=%s", async (otherFirst) => {
  const files = store();
  const rpc = account();
  let nonce = 7;
  let failed = false;
  const landed: string[] = [];
  rpc.getNonce.mockImplementation(async () => String(nonce));
  rpc.execute.mockImplementation(async (calls, options) => {
    expect(options.nonce).toBe(String(nonce));
    if (calls === desired && !failed) {
      failed = true;
      throw new Error("before submission");
    }
    landed.push(calls[0]!.contractAddress);
    return { transaction_hash: `0x${nonce++}` };
  });
  const retry = () => send(rpc as unknown as Account, desired, files, "pay", () => {}, 5);
  const other = () => send(rpc as unknown as Account, tampered, files, "other", () => {}, 5);
  await expect(retry()).rejects.toThrow("before submission");
  if (otherFirst) await other();
  await retry();
  if (!otherFirst) await other();
  await retry();
  expect(landed).toEqual(otherFirst ? ["0xbad", "0x1"] : ["0x1", "0xbad"]);
});

test("an unpinned effect read cannot authorize nonce recovery", async () => {
  const files = store();
  const rpc = account();
  files.write(transactionIntentName(rpc, desired, "pay"), { nonce: "7" });
  await expect(send(rpc as unknown as Account, desired, files, "pay", () => {}, undefined as never)).rejects.toThrow(
    "Confirmed effect-read block required",
  );
  expect(rpc.getNonce).not.toHaveBeenCalled();
  expect(rpc.execute).not.toHaveBeenCalled();
});
