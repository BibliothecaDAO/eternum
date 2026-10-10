import { Account, RpcProvider } from "starknet";
import { expect, test, spyOn } from "bun:test";
import { readRoleHandoffState, confirmRole } from "./service-role-check";

test("role handoff state comes only from the three Games views, without a Worker intent or any signing", async () => {
  for (const [installed, handedOff] of [
    ["0x0012", false],
    ["0x34", true],
  ] as const) {
    const calls: unknown[] = [];
    const state = await readRoleHandoffState({
      provider: {
        async callContract(...args: unknown[]) {
          calls.push(args);
          return [installed];
        },
      },
      world: "0x56",
      bootstrap: "0x12",
    });
    expect(state).toEqual({ handedOff });
    expect(calls).toEqual(
      ["owner", "launcher", "ledger_operator"].map((entrypoint) => [
        { contractAddress: "0x56", entrypoint, calldata: [] },
        "latest",
      ]),
    );
  }
});

test("a missing or malformed launcher view fails instead of assuming bootstrap authority", async () => {
  for (const reply of [[], ["not a felt"], ["0x12", "0x34"]])
    await expect(
      readRoleHandoffState({
        provider: {
          async callContract() {
            return reply;
          },
        },
        world: "0x56",
        bootstrap: "0x12",
      }),
    ).rejects.toThrow();
  await expect(
    readRoleHandoffState({
      provider: {
        async callContract() {
          throw new Error("node unavailable");
        },
      },
      world: "0x56",
      bootstrap: "0x12",
    }),
  ).rejects.toThrow();
});

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
    read.mockResolvedValue(["0x34"]);
    await confirmRole({
      directory: "/unused",
      manifest: { world: { address: "0x56" } } as never,
      provider: new RpcProvider({ nodeUrl: "http://127.0.0.1:1" }),
      bootstrap: "0x12",
      account: "0x34",
      role: "launcher",
    });
    expect(send).toHaveBeenCalledTimes(2);
  } finally {
    for (const mock of [send, ownerRead, read, status, receipt]) mock.mockRestore();
    if (saved === undefined) delete process.env.DEPLOYER_PRIVATE_KEY;
    else process.env.DEPLOYER_PRIVATE_KEY = saved;
  }
});
