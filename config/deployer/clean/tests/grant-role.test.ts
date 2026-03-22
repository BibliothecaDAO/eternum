import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

const executeMock = mock(async (calls: unknown[]) => ({ transaction_hash: "0xgranttx", calls }));
const waitForTransactionMock = mock(async () => ({ execution_status: "SUCCEEDED" }));

mock.module("starknet", () => ({
  RpcProvider: class RpcProvider {
    constructor(_options: unknown) {}
  },
  Account: class Account {
    constructor(_options: unknown) {}

    execute(calls: unknown[]) {
      return executeMock(calls);
    }

    waitForTransaction(transactionHash: string) {
      return waitForTransactionMock(transactionHash);
    }
  },
}));

const { buildGrantRoleCall, grantRoles } = await import("../role-grants/grant-role");

describe("grantRoles", () => {
  afterEach(() => {
    executeMock.mockClear();
    waitForTransactionMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test("submits one multicall transaction for multiple grant_role calls", async () => {
    const calls = [
      buildGrantRoleCall("0xvillagepass", "0xminter", "0xrealm"),
      buildGrantRoleCall("0xvillagepass", "0xdistributor", "0xvillage"),
    ];

    const result = await grantRoles({
      chain: "slot",
      calls,
      rpcUrl: "https://rpc.example",
      accountAddress: "0xadmin",
      privateKey: "0xprivate",
    });

    expect(result.transactionHash).toBe("0xgranttx");
    expect(result.calls).toEqual(calls);
    expect(executeMock.mock.calls).toHaveLength(1);
    expect(executeMock.mock.calls[0]?.[0]).toEqual(calls);
    expect(waitForTransactionMock.mock.calls).toEqual([["0xgranttx"]]);
  });

  test("supports dry run without resolving credentials or submitting a transaction", async () => {
    const calls = [
      buildGrantRoleCall("0xvillagepass", "0xminter", "0xrealm"),
      buildGrantRoleCall("0xvillagepass", "0xdistributor", "0xvillage"),
    ];

    const result = await grantRoles({
      chain: "slot",
      calls,
      rpcUrl: "https://rpc.example",
      dryRun: true,
    });

    expect(result.transactionHash).toBeUndefined();
    expect(result.calls).toEqual(calls);
    expect(executeMock.mock.calls).toHaveLength(0);
    expect(waitForTransactionMock.mock.calls).toHaveLength(0);
  });
});
