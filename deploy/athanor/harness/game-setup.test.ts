import { test, expect, spyOn } from "bun:test";
import { Account, RpcProvider, type Call } from "starknet";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchHarnessGame } from "./game-setup";

test("Eternum setup confirms each entry entitlement before returning players to the driver", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eternum-entries-"));
  const saved = { ...process.env };
  const calls: Call[] = [];
  const events: string[] = [];
  const chain = spyOn(RpcProvider.prototype, "getChainId").mockResolvedValue("0x534e5f5345504f4c4941");
  const read = spyOn(Account.prototype, "callContract").mockResolvedValue(["9000000"]);
  const send = spyOn(Account.prototype, "execute").mockImplementation(async (call) => {
    calls.push(call as Call);
    events.push("sent");
    return { transaction_hash: "0x123" };
  });
  const status = spyOn(Account.prototype, "getTransactionStatus").mockResolvedValue({
    finality_status: "ACCEPTED_ON_L2",
    execution_status: "SUCCEEDED",
  });
  const receipt = spyOn(Account.prototype, "getTransactionReceipt").mockImplementation(async () => {
    events.push("confirmed");
    return { block_number: 1, execution_status: "SUCCEEDED" } as never;
  });
  try {
    const manifest = join(directory, "manifest.json");
    await writeFile(
      manifest,
      JSON.stringify({ shard: { chainId: "0x534e5f5345504f4c4941" }, world: { address: "0x123" } }),
    );
    Object.assign(process.env, {
      NATIVE_WORLD_MANIFEST: manifest,
      HARNESS_ADMIN_RPC_URL: "http://127.0.0.1:1",
      DEPLOYER_ACCOUNT_ADDRESS: "0x42",
      DEPLOYER_PRIVATE_KEY: "0x123",
    });
    await launchHarnessGame({
      gameId: 7,
      gameName: "entries",
      presetId: 103,
      minutes: 1,
      owners: ["0x10", "0x20"],
    });
    expect(calls.map((call) => [call.entrypoint, call.calldata])).toEqual([
      ["register_entitlement", ["7", "16", "1", "0", String(BigInt("0x0103070402020302010009")), "0", "0", "1"]],
      ["register_entitlement", ["7", "32", "2", "0", String(BigInt("0x0103070402020302010009")), "0", "0", "1"]],
    ]);
    expect(events).toEqual(["sent", "confirmed", "sent", "confirmed"]);
  } finally {
    chain.mockRestore();
    read.mockRestore();
    send.mockRestore();
    status.mockRestore();
    receipt.mockRestore();
    for (const key of [
      "NATIVE_WORLD_MANIFEST",
      "HARNESS_ADMIN_RPC_URL",
      "DEPLOYER_ACCOUNT_ADDRESS",
      "DEPLOYER_PRIVATE_KEY",
    ])
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    await rm(directory, { recursive: true, force: true });
  }
});
