import { Account, type ProviderInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceKeyOf, joinRealmsAccount } from "./realms-account";

const shard = { chainId: "0x1", accountClassHash: "0x2", guardianPublicKey: "0x3" };
const device = deviceKeyOf("0x4");
const approve = vi.fn(async () => ["0x5", "0x6"]);

const provider = (deployed: boolean) =>
  ({
    getClassHashAt: vi.fn(async () => {
      if (!deployed) throw { code: 20 };
      return shard.accountClassHash;
    }),
    callContract: vi.fn(async ({ entrypoint }: { entrypoint: string }) =>
      entrypoint === "is_device" ? ["0x0"] : ["0x1"],
    ),
    getEvents: vi.fn(async () => ({ events: [] })),
    waitForTransaction: vi.fn(async () => ({})),
  }) as unknown as ProviderInterface;

afterEach(() => vi.restoreAllMocks());

describe("joining a shard", () => {
  it("deploys with no tip, so nothing estimates one from recent blocks", async () => {
    const deployAccount = vi.spyOn(Account.prototype, "deployAccount").mockResolvedValue({
      contract_address: "0x7",
      transaction_hash: "0x8",
    });
    await joinRealmsAccount({ provider: provider(false), shard, realmsId: "0x9", device, approve });
    expect(deployAccount).toHaveBeenCalledOnce();
    expect(deployAccount.mock.calls[0][1]).toEqual({ tip: 0 });
  });

  it("adds this device to a deployed account with no tip", async () => {
    const execute = vi.spyOn(Account.prototype, "execute").mockResolvedValue({ transaction_hash: "0x8" });
    await joinRealmsAccount({ provider: provider(true), shard, realmsId: "0x9", device, approve });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][1]).toEqual({ tip: 0 });
    expect(approve).toHaveBeenCalledWith(expect.objectContaining({ action: "ADD", counter: 2 }));
  });
});
