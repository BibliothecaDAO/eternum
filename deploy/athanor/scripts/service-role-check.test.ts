import { Account, RpcProvider } from "starknet";
import { expect, test, spyOn } from "bun:test";
import { confirmRole } from "./service-role-check";

test("handoff refuses a successful setter receipt while either role still names bootstrap", async () => {
  const saved = process.env.DEPLOYER_PRIVATE_KEY;
  process.env.DEPLOYER_PRIVATE_KEY = "0x123";
  const send = spyOn(Account.prototype, "execute").mockResolvedValue({ transaction_hash: "0x123" });
  const ownerRead = spyOn(Account.prototype, "callContract").mockImplementation(async (call) => [
    call.entrypoint === "owner" ? "0x12" : call.entrypoint === "is_device" ? "0x1" : "9000000",
  ]);
  const read = spyOn(RpcProvider.prototype, "callContract").mockResolvedValue(["0x12"]);
  const status = spyOn(RpcProvider.prototype, "getTransactionStatus").mockResolvedValue({
    finality_status: "ACCEPTED_ON_L2",
    execution_status: "SUCCEEDED",
  });
  const receipt = spyOn(RpcProvider.prototype, "getTransactionReceipt").mockResolvedValue({
    block_number: 1,
    execution_status: "SUCCEEDED",
  } as never);
  try {
    for (const role of ["launcher", "ledger_operator"] as const) {
      await expect(
        confirmRole({
          directory: "/unused",
          manifest: { world: { address: "0x56" } } as never,
          provider: new RpcProvider({ nodeUrl: "http://127.0.0.1:1" }),
          bootstrap: "0x12",
          account: "0x34",
          role,
        }),
      ).rejects.toThrow("Role handoff was not confirmed");
    }
    expect(send.mock.calls.map(([call]) => (call as { entrypoint: string }).entrypoint)).toEqual([
      "set_launcher",
      "set_ledger_operator",
    ]);
    for (const role of ["launcher", "ledger_operator"] as const) {
      read.mockImplementation(async (call) => [call.entrypoint === role ? "0x34" : "0x56"]);
      await confirmRole({
        directory: "/unused",
        manifest: { world: { address: "0x56" } } as never,
        provider: new RpcProvider({ nodeUrl: "http://127.0.0.1:1" }),
        bootstrap: "0x12",
        account: "0x34",
        role,
      });
    }
    expect(send).toHaveBeenCalledTimes(2);
  } finally {
    for (const mock of [send, ownerRead, read, status, receipt]) mock.mockRestore();
    if (saved === undefined) delete process.env.DEPLOYER_PRIVATE_KEY;
    else process.env.DEPLOYER_PRIVATE_KEY = saved;
  }
});

test("either service role refuses the other role's account before any signing, including an existing shared role", async () => {
  const send = spyOn(Account.prototype, "execute").mockRejectedValue(new Error("unexpected signing"));
  try {
    for (const role of ["launcher", "ledger_operator"] as const) {
      for (const current of ["0x12", "0x34"]) {
        const reads: string[] = [];
        await expect(
          confirmRole({
            directory: "/unused",
            manifest: { world: { address: "0x56" } } as never,
            provider: {
              async callContract(call: { entrypoint: string }) {
                reads.push(call.entrypoint);
                return [call.entrypoint === role ? current : "0x0034"];
              },
            } as never,
            bootstrap: "0x12",
            account: "0x34",
            role,
          }),
        ).rejects.toThrow("Launcher and ledger operator must be different accounts");
        expect(reads).toEqual([role === "launcher" ? "ledger_operator" : "launcher"]);
      }
    }
    expect(send).not.toHaveBeenCalled();
  } finally {
    send.mockRestore();
  }
});
