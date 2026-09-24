import { Account, hash, num, type ProviderInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceKeyOf, joinRealmsAccount, readAccountDevices, revokeDeviceEverywhere } from "./realms-account";

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

  it("runs one join when the same device joins twice at once", async () => {
    const execute = vi.spyOn(Account.prototype, "execute").mockResolvedValue({ transaction_hash: "0x8" });
    const guardian = vi.fn(async () => ["0x5", "0x6"]);
    const shardProvider = provider(true);
    const [first, second] = await Promise.all([
      joinRealmsAccount({ provider: shardProvider, shard, realmsId: "0x9", device, approve: guardian }),
      joinRealmsAccount({ provider: shardProvider, shard, realmsId: "0x9", device, approve: guardian }),
    ]);
    expect(guardian).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(second).toBe(first);
  });
});

const DEVICE_ADDED = num.toHex(hash.starknetKeccak("DeviceAdded"));

/** Each fake shard is its own chain, as every listed shard is. */
const chainOf = (url: string) => num.toHex(BigInt(`0x${Buffer.from(url).toString("hex")}`) % 2n ** 250n);

/** A shard where the account is deployed with these devices; `signs` says whether this device is one of them. */
const accountShard = (url: string, { devices = ["0xa1"], signs = true } = {}) => ({
  ...shard,
  chainId: chainOf(url),
  url,
  provider: {
    getClassHashAt: vi.fn(async () => shard.accountClassHash),
    callContract: vi.fn(async ({ entrypoint }: { entrypoint: string }) =>
      entrypoint === "is_device" ? [signs ? "0x1" : "0x0"] : ["0x1"],
    ),
    getEvents: vi.fn(async () => ({ events: devices.map((key) => ({ keys: [DEVICE_ADDED, key] })) })),
    waitForTransaction: vi.fn(async () => ({})),
  } as unknown as ProviderInterface,
});

/** A shard whose node does not answer. */
const deadShard = (url: string) => ({
  ...shard,
  chainId: chainOf(url),
  url,
  provider: {
    getClassHashAt: vi.fn(async () => Promise.reject(new Error("node unreachable"))),
    callContract: vi.fn(async () => Promise.reject(new Error("node unreachable"))),
    getEvents: vi.fn(async () => Promise.reject(new Error("node unreachable"))),
  } as unknown as ProviderInterface,
});

describe("the account's devices across shards", () => {
  it("lists what the readable shards hold and names each shard it could not read", async () => {
    const a = accountShard("https://a.test", { devices: ["0xa1", "0xb2"] });
    const b = accountShard("https://b.test", { devices: ["0xb2"] });

    const { devices, failures } = await readAccountDevices("0x9", [a, deadShard("https://dead.test"), b]);

    expect([...devices].map(([key, on]) => [key, on.map(({ url }) => url)])).toEqual([
      ["0xa1", ["https://a.test"]],
      ["0xb2", ["https://a.test", "https://b.test"]],
    ]);
    expect(failures).toEqual([{ shard: "https://dead.test", error: new Error("node unreachable") }]);
  });

  it("revokes on every shard, joining first where this device never signed, and names the shards that failed", async () => {
    const execute = vi.spyOn(Account.prototype, "execute").mockResolvedValue({ transaction_hash: "0x8" });
    vi.spyOn(Account.prototype, "waitForTransaction").mockResolvedValue({} as never);
    const guardian = vi.fn(async () => ["0x5", "0x6"]);
    const joined = accountShard("https://joined.test", { signs: true });
    const neverJoined = accountShard("https://never-joined.test", { signs: false });

    const failures = await revokeDeviceEverywhere({
      shards: [joined, deadShard("https://dead.test"), neverJoined],
      realmsId: "0x9",
      device,
      deviceKey: "0xa1",
      approve: guardian,
    });

    expect(failures).toEqual([{ shard: "https://dead.test", error: new Error("node unreachable") }]);
    const revocations = execute.mock.calls.filter(
      ([call]) => (call as { entrypoint: string }).entrypoint === "revoke_device",
    );
    expect(revocations).toHaveLength(2);
    expect(guardian.mock.calls.map(([change]) => change.action).sort()).toEqual(["ADD", "REVOKE", "REVOKE"]);
  });
});
