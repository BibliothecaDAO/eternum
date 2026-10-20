import { Account, RpcError, RpcProvider, hash, num, type ProviderInterface } from "starknet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { realmsAccountAddress } from "@realms-world/identity/account";

import { executeGameplayAccountTransaction } from "../client/submit";
import {
  deviceKeyOf,
  DeviceLimitError,
  joinBotAccount,
  joinRealmsAccount,
  readAccountDevices,
  revokeDeviceEverywhere,
} from "./realms-account";

const shard = { chainId: "0x1", accountClassHash: "0x2", guardianPublicKey: "0x3", l2GasBound: "0x47868c00" };
/** What every join and device transaction carries: no tip, and the shard's fee-free bounds instead of a fee estimate. */
const FEE_FREE = {
  tip: 0,
  resourceBounds: {
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: 0x47868c00n, max_price_per_unit: 0n },
  },
};
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

// The account's own reads go to its own channel, not to these fake providers: its device changes are numbered by the
// gameplay queue, which reads the nonce and polls inclusion through the account.
beforeEach(() => {
  vi.spyOn(Account.prototype, "getNonce").mockResolvedValue("0x7");
  vi.spyOn(Account.prototype, "getTransactionStatus").mockResolvedValue({
    finality_status: "PRE_CONFIRMED",
  } as never);
});
afterEach(() => vi.restoreAllMocks());

describe("joining a shard", () => {
  it("refuses insecure bot enrollment before sending the operator credential", async () => {
    const send = vi.spyOn(globalThis, "fetch");
    await expect(
      joinBotAccount({
        provider: provider(false),
        shard,
        label: "0x99",
        device,
        identity: { url: "http://identity.test/api", operatorToken: "fixture-token" },
      }),
    ).rejects.toThrow("HTTPS");
    expect(send).not.toHaveBeenCalled();
  });

  it("enrolls a bot with redirects disabled on the credential-bearing request", async () => {
    vi.spyOn(Account.prototype, "deployAccount").mockResolvedValue({
      contract_address: "0x7",
      transaction_hash: "0x8",
    });
    const send = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ signature: ["0x5", "0x6"] }));
    await joinBotAccount({
      provider: provider(false),
      shard,
      label: "0x99",
      device,
      identity: { url: "https://identity.test/api", operatorToken: "fixture-token" },
    });
    expect(send).toHaveBeenCalledWith(
      "https://identity.test/api/devices/bots",
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(new Headers(send.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer fixture-token");
  });

  it("deploys with no tip and the shard's fee-free bounds, so it sends neither a tip nor a fee estimate", async () => {
    const deployAccount = vi.spyOn(Account.prototype, "deployAccount").mockResolvedValue({
      contract_address: "0x7",
      transaction_hash: "0x8",
    });
    await joinRealmsAccount({ provider: provider(false), shard, realmsId: "0x9", device, approve });
    expect(deployAccount).toHaveBeenCalledOnce();
    expect(deployAccount.mock.calls[0][1]).toEqual(FEE_FREE);
  });

  it("sends no fee estimate through starknet.js when it deploys, the stamping RPC's account allowance being one per join", async () => {
    const estimate = vi.spyOn(Account.prototype, "estimateAccountDeployFee");
    vi.spyOn(Account.prototype, "accountInvocationsFactory").mockResolvedValue([{}] as never);
    // Account.deployAccount sends through its parent's method, so the send is stubbed there.
    const send = vi
      .spyOn(RpcProvider.prototype, "deployAccountContract")
      .mockResolvedValue({ contract_address: "0x7", transaction_hash: "0x8" });
    await joinRealmsAccount({ provider: provider(false), shard, realmsId: "0x10", device, approve });
    expect(estimate).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
  });

  it("adds this device to a deployed account with no tip and the shard's fee-free bounds", async () => {
    const execute = vi.spyOn(Account.prototype, "execute").mockResolvedValue({ transaction_hash: "0x8" });
    await joinRealmsAccount({ provider: provider(true), shard, realmsId: "0x9", device, approve });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][1]).toMatchObject(FEE_FREE);
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

    expect(failures).toMatchObject([
      {
        shard: "https://dead.test",
        error: { message: "account_join_read_failed", cause: new Error("node unreachable") },
      },
    ]);
    const revocations = execute.mock.calls.filter(
      ([call]) => (call as { entrypoint: string }).entrypoint === "revoke_device",
    );
    expect(revocations).toHaveLength(2);
    expect(guardian.mock.calls.map(([change]) => change.action).sort()).toEqual(["ADD", "REVOKE", "REVOKE"]);
  });
});

it("names the failing join read and keeps the underlying error out of its public message", async () => {
  const cause = new Error("private RPC request body");
  const rpc = provider(false);
  vi.mocked(rpc.getClassHashAt).mockRejectedValue(cause);
  const error = await joinRealmsAccount({ provider: rpc, shard, realmsId: "0x99", device, approve }).catch(
    (error) => error,
  );
  expect(error.message).toBe("account_join_read_failed");
  expect(error.cause).toBe(cause);
});

describe("device-limit join refusals", () => {
  const refused = () =>
    new RpcError({ code: -32010, message: "Transaction refused" } as never, "starknet_addInvokeTransaction", {});
  const activeDevices = (count: number) => ({
    events: Array.from({ length: count }, (_, index) => ({ keys: [DEVICE_ADDED, num.toHex(index + 100)] })),
  });

  it("recognizes a real join submission refusal only after counting this chain's active devices, then can retry", async () => {
    const rpc = provider(true);
    vi.mocked(rpc.getEvents).mockResolvedValue(activeDevices(8) as never);
    const execute = vi.spyOn(Account.prototype, "execute").mockRejectedValueOnce(refused());
    const input = { provider: rpc, shard, realmsId: "0x99", device, approve };
    await expect(joinRealmsAccount(input)).rejects.toBeInstanceOf(DeviceLimitError);
    expect(execute).toHaveBeenCalledOnce();
    // A signed-in device removes one; the next join reads a fresh counter and submits again.
    vi.mocked(rpc.getEvents).mockResolvedValue(activeDevices(7) as never);
    execute.mockResolvedValue({ transaction_hash: "0x8" });
    const account = await joinRealmsAccount(input);
    expect(account.address).toMatch(/^0x/);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("does not call every RPC refusal a device limit, including when revoked devices reduce the active count", async () => {
    const rpc = provider(true);
    const history = activeDevices(8);
    history.events.push({ keys: [num.toHex(hash.starknetKeccak("DeviceRevoked")), "0x64"] });
    vi.mocked(rpc.getEvents).mockResolvedValue(history as never);
    const cause = refused();
    vi.spyOn(Account.prototype, "execute").mockRejectedValue(cause);
    await expect(joinRealmsAccount({ provider: rpc, shard, realmsId: "0x99", device, approve })).rejects.toMatchObject({
      message: "account_join_device_add_failed",
      cause: { name: "TransactionNotSentError", cause },
    });
  });

  it("keeps an unreadable device list as a read failure rather than claiming eight devices", async () => {
    const rpc = provider(true);
    vi.mocked(rpc.getEvents)
      .mockResolvedValueOnce({ events: [] } as never)
      .mockRejectedValue(new Error("offline"));
    vi.spyOn(Account.prototype, "execute").mockRejectedValue(refused());
    await expect(joinRealmsAccount({ provider: rpc, shard, realmsId: "0x99", device, approve })).rejects.toMatchObject({
      message: "account_join_events_failed",
      cause: new Error("offline"),
    });
  });
});

/**
 * One account on a node that holds one transaction per nonce and executes from the account's nonce upwards, a block
 * every 250 ms after `heldBlocks` empty ones. A spent nonce is refused before forwarding; a second transaction at an
 * occupied nonce is forwarded and rejected by the node, so the sender learns nothing (an unknown outcome).
 */
function heldNode(address: string, heldBlocks: number) {
  let nonce = 7n;
  let blocks = 0;
  const held = new Map<bigint, string>();
  const landed: [bigint, string][] = [];
  const sent: [bigint, string][] = [];
  setInterval(() => {
    if ((blocks += 1) <= heldBlocks) return;
    for (let what = held.get(nonce); what; what = held.get(nonce)) {
      landed.push([nonce, what]);
      held.delete(nonce);
      nonce += 1n;
    }
  }, 250);
  const hashOf = (at: bigint, what: string) => `0x${Buffer.from(`${what}@${at}`).toString("hex")}`;
  const receive = async (what: string, at: bigint) => {
    sent.push([at, what]);
    if (at < nonce)
      throw Object.assign(new Error("Transaction refused"), { baseError: { code: -32010, data: { reason: "nonce" } } });
    if (held.has(at))
      throw Object.assign(new Error("Transaction outcome unknown"), {
        baseError: { code: -32011, data: { transaction_hash: hashOf(at, what) } },
      });
    held.set(at, what);
    return { transaction_hash: hashOf(at, what) };
  };
  const status = async (transactionHash: string) => {
    if (landed.some(([at, what]) => hashOf(at, what) === transactionHash)) return { finality_status: "PRE_CONFIRMED" };
    throw Object.assign(new Error("Transaction hash not found"), { baseError: { code: 29 } });
  };
  const included = async (transactionHash: string) => {
    while (!landed.some(([at, what]) => hashOf(at, what) === transactionHash))
      await new Promise((resolve) => setTimeout(resolve, 50));
    return {};
  };
  // The account's own sends, reads and receipt waits: a device change is sent by a starknet.js Account. One sent with
  // no nonce takes the node's current one, as starknet.js reads it.
  vi.spyOn(Account.prototype, "execute").mockImplementation(async (calls, details) => {
    const call = (Array.isArray(calls) ? calls[0] : calls) as { entrypoint: string };
    return receive(call.entrypoint, details?.nonce === undefined ? nonce : BigInt(details.nonce));
  });
  vi.spyOn(Account.prototype, "getNonce").mockImplementation(async () => `0x${nonce.toString(16)}`);
  vi.spyOn(Account.prototype, "getTransactionStatus").mockImplementation(status as never);
  vi.spyOn(Account.prototype, "waitForTransaction").mockImplementation(included as never);
  return {
    sent: () => sent,
    landed: () => landed,
    /** The browser's play, through the gameplay queue as the game client sends it. */
    play: (stopped?: AbortSignal) =>
      executeGameplayAccountTransaction({
        account: {
          address,
          execute: async (_calls: unknown, details?: { nonce?: unknown }) =>
            receive("play", BigInt(details!.nonce as string)),
          getNonce: async () => `0x${nonce.toString(16)}`,
          getTransactionStatus: status,
        } as never,
        calls: { contractAddress: "0x1", entrypoint: "play", calldata: [] },
        shard: { chainId: shard.chainId, l2GasBound: BigInt(shard.l2GasBound) },
        stopped,
      }),
    /** The shard's reads of the account, for the device operations. */
    provider: (signs: boolean) =>
      ({
        getClassHashAt: vi.fn(async () => shard.accountClassHash),
        callContract: vi.fn(async ({ entrypoint }: { entrypoint: string }) =>
          entrypoint === "is_device" ? [signs ? "0x1" : "0x0"] : ["0x1"],
        ),
        getEvents: vi.fn(async () => ({ events: [] })),
        waitForTransaction: vi.fn(included),
      }) as unknown as ProviderInterface,
  };
}

// A play of this browser is still held when the account changes its devices: the device change must take the nonce
// after the play's, never the held one, and both must land.
describe("a device change while a play of this browser is held", () => {
  afterEach(() => vi.useRealTimers());

  it("joining as a device takes the nonce after the held play, and both land", async () => {
    vi.useFakeTimers();
    const realmsId = "0x77";
    const node = heldNode(realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey), 4);
    const play = node.play();
    await vi.advanceTimersByTimeAsync(10);
    const join = joinRealmsAccount({ provider: node.provider(false), shard, realmsId, device, approve });
    void join.catch(() => {});
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(join).resolves.toBeInstanceOf(Account);
    await expect((await play).inBlock).resolves.toBeUndefined();
    expect(node.sent()).toEqual([
      [7n, "play"],
      [8n, "is_device"],
    ]);
    expect(node.landed()).toEqual([
      [7n, "play"],
      [8n, "is_device"],
    ]);
  });

  it("revoking a device takes the nonce after the held play, and both land", async () => {
    vi.useFakeTimers();
    const realmsId = "0x78";
    const node = heldNode(realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey), 4);
    const play = node.play();
    await vi.advanceTimersByTimeAsync(10);
    const revoked = revokeDeviceEverywhere({
      shards: [{ ...shard, url: "https://dev.test", provider: node.provider(true) }],
      realmsId,
      device,
      deviceKey: "0xa1",
      approve,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(revoked).resolves.toEqual([]);
    await expect((await play).inBlock).resolves.toBeUndefined();
    expect(node.sent()).toEqual([
      [7n, "play"],
      [8n, "revoke_device"],
    ]);
    expect(node.landed()).toEqual([
      [7n, "play"],
      [8n, "revoke_device"],
    ]);
  });
});
