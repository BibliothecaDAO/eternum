import { beforeEach, expect, it, vi } from "vitest";
import { botRealmsId, realmsAccountAddress } from "@realms-world/identity/account";
import { shortString } from "starknet";
import { nativePresetIdFor } from "../../../config/source/native";
import { LauncherDeployment } from "./launcher-deployment";
const mock = vi.hoisted(() => ({
  manifest: vi.fn(),
  chain: vi.fn(),
  join: vi.fn(),
  head: vi.fn(),
  launcher: vi.fn(),
  create: vi.fn(),
  gameId: vi.fn(),
  confirm: vi.fn(),
  creationTransaction: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: mock.chain }),
}));
vi.mock("./executor", () => ({ readLaunchShard: mock.manifest }));
vi.mock("@bibliothecadao/eternum/realms-account", () => ({
  joinRealmsAccount: mock.join,
  deviceKeyOf: () => ({ privateKey: "0x1", publicKey: "0x2" }),
}));
vi.mock("./shard-client", () => ({
  LaunchShard: vi.fn(function () {
    return {
      head: mock.head,
      view: mock.launcher,
      create: mock.create,
      gameId: mock.gameId,
      confirm: mock.confirm,
      creationTransaction: mock.creationTransaction,
    };
  }),
}));
const presetId = nativePresetIdFor("blitz");
const chainId = "0x1",
  heraldUrl = "https://shard.test";
const own = realmsAccountAddress(botRealmsId(shortString.encodeShortString("ETERNUM_LAUNCHER")), "0x2", "0x9");
const cache = new Map<string, unknown>();
const storage = {
  get: async <T>(key: string) => cache.get(key) as T | undefined,
  put: async <T>(key: string, value: T) => {
    cache.set(key, value);
  },
};
const env = {
  VALUE_IDENTITY: { shards: async () => [{ chainId, url: heraldUrl, status: "pending" as const }] },
  BASE_URL: "https://app.test",
  DEPLOYER_PRIVATE_KEY: "0x1",
  OPERATOR_TOKEN: "test",
  IDENTITY: { fetch: vi.fn(async () => Response.json({ accountClassHash: "0x2", publicKey: "0x9" })) },
};
const deploy = () => new LauncherDeployment(env, storage);
beforeEach(() => {
  vi.clearAllMocks();
  mock.chain.mockResolvedValue("0x1");
  cache.clear();
  mock.manifest.mockResolvedValue({
    shard: {
      url: heraldUrl,
      status: "pending",
      chainId,
      accountClassHash: "0x2",
      guardianPublicKey: "0x9",
      rpcUrl: heraldUrl + "/rpc",
      contracts: { games: "0x77" },
    },
  });
  mock.join.mockResolvedValue({ address: own });
  mock.launcher.mockResolvedValue(BigInt(own));
  mock.head.mockResolvedValue({ timestamp: 100, block_number: 10 });
  mock.gameId.mockResolvedValue(0);
  mock.create.mockImplementation(async (_request, _at, submitted) => {
    if (submitted) await submitted("0xabc");
    return { gameId: 7, createGameTxHash: "0xabc" };
  });
});
it("enrolls the Worker's own bot under the pinned guardian and class, and keeps its public identity on retry", async () => {
  expect(await deploy().enrol({ chainId, heraldUrl })).toEqual({ chainId, launcherAccount: own });
  expect(mock.join.mock.calls[0][0]).toMatchObject({
    shard: { accountClassHash: "0x2", guardianPublicKey: "0x9" },
    realmsId: botRealmsId(shortString.encodeShortString("ETERNUM_LAUNCHER")),
  });
  expect(await deploy().enrol({ chainId, heraldUrl })).toEqual({ chainId, launcherAccount: own });
  expect(mock.join).toHaveBeenCalledOnce();
  mock.manifest.mockRejectedValueOnce(new Error("unlisted_shard"));
  await expect(deploy().enrol({ chainId: "0x2", heraldUrl })).rejects.toThrow("unlisted_shard");
});
it("requires enrollment and launcher authority before the fixed empty-roster creation", async () => {
  const check = { chainId, heraldUrl, name: "check-worker-0123456789abcdef", presetId };
  await expect(deploy().check(check)).rejects.toThrow("launcher_not_enrolled");
  await deploy().enrol({ chainId, heraldUrl });
  mock.launcher.mockResolvedValue(0x99n);
  await expect(deploy().check(check)).rejects.toThrow("launcher_role_not_granted");
  expect(mock.create).not.toHaveBeenCalled();
  mock.launcher.mockResolvedValue(BigInt(own));
  expect(await deploy().check(check)).toEqual({ txHash: "0xabc" });
  expect(mock.create.mock.calls[0][0]).toMatchObject({
    gameName: check.name,
    version: String(presetId),
    rosterAccounts: [],
    devModeOn: false,
  });
  mock.gameId.mockResolvedValue(7);
  expect(await deploy().check(check)).toEqual({ txHash: "0xabc" });
  expect(mock.create).toHaveBeenCalledOnce();
});
it("refuses changed check presets and never returns a later no-op transaction", async () => {
  await deploy().enrol({ chainId, heraldUrl });
  const check = { chainId, heraldUrl, name: "check-worker-0123456789abcdef", presetId };
  await deploy().check(check);
  await expect(deploy().check({ ...check, presetId: nativePresetIdFor("frontier") })).rejects.toThrow(
    "launcher_check_identity_differs",
  );
  expect(mock.create).toHaveBeenCalledOnce();
});

it("recovers the submitted original hash after confirmation or response delivery fails", async () => {
  await deploy().enrol({ chainId, heraldUrl });
  const check = { chainId, heraldUrl, name: "check-worker-0123456789abcdef", presetId };
  mock.create.mockImplementation(async (_request, _at, submitted) => {
    await submitted("0xabc");
    throw new Error("transport");
  });
  await expect(deploy().check(check)).rejects.toThrow();
  mock.gameId.mockResolvedValue(7);
  expect(await deploy().check(check)).toEqual({ txHash: "0xabc" });
  expect(mock.confirm).toHaveBeenCalledWith("0xabc");
  expect(mock.create).toHaveBeenCalledOnce();
});
it("finds the first creation rather than issuing a no-op when its submission response was lost", async () => {
  await deploy().enrol({ chainId, heraldUrl });
  mock.gameId.mockResolvedValue(7);
  mock.creationTransaction.mockResolvedValue("0xdef");
  const check = { chainId, heraldUrl, name: "check-worker-0123456789abcdef", presetId };
  expect(await deploy().check(check)).toEqual({ txHash: "0xdef" });
  expect(mock.create).not.toHaveBeenCalled();
});

it("refuses a proxy on another chain or an identity with different pins before enrollment", async () => {
  mock.chain.mockResolvedValue("0x2");
  await expect(deploy().enrol({ chainId, heraldUrl })).rejects.toThrow("launcher_chain_differs");
  mock.chain.mockResolvedValue(chainId);
  env.IDENTITY.fetch.mockResolvedValueOnce(Response.json({ accountClassHash: "0x999", publicKey: "0x9" }));
  await expect(deploy().enrol({ chainId, heraldUrl })).rejects.toThrow("launcher_identity_differs");
  expect(mock.join).not.toHaveBeenCalled();
});

it("aligns a Frontier check game to the same native calendar rule as ordinary launches", async () => {
  await deploy().enrol({ chainId, heraldUrl });
  const id = nativePresetIdFor("frontier");
  await deploy().check({ chainId, heraldUrl, name: "check-worker-0123456789abcdef", presetId: id });
  const request = mock.create.mock.calls[0]![0];
  expect((Date.parse(request.gameStartTime) / 1000) % 120).toBe(0);
  expect(request.environment).toBe("madara.frontier");
});

it("never exposes an enrolled signer to due launches until the shard grants launcher", async () => {
  await deploy().enrol({ chainId, heraldUrl });
  mock.launcher.mockResolvedValue(0x99n);
  await expect(deploy().account(chainId)).rejects.toThrow("launcher_role_not_granted");
  expect(mock.create).not.toHaveBeenCalled();
  mock.launcher.mockResolvedValue(BigInt(own));
  expect(await deploy().account(chainId)).toBe(own);
});
