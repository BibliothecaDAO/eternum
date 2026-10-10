import { beforeEach, expect, it, vi } from "vitest";
import { botRealmsId, realmsAccountAddress } from "@realms-world/identity/account";
import { shortString } from "starknet";
import { LauncherDeployment } from "./launcher-deployment";
const mock = vi.hoisted(() => ({
  manifest: vi.fn(),
  chain: vi.fn(),
  join: vi.fn(),
  launcher: vi.fn(),
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
      view: mock.launcher,
    };
  }),
}));
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
it("refuses a proxy on another chain or an identity with different pins before enrollment", async () => {
  mock.chain.mockResolvedValue("0x2");
  await expect(deploy().enrol({ chainId, heraldUrl })).rejects.toThrow("launcher_chain_differs");
  mock.chain.mockResolvedValue(chainId);
  env.IDENTITY.fetch.mockResolvedValueOnce(Response.json({ accountClassHash: "0x999", publicKey: "0x9" }));
  await expect(deploy().enrol({ chainId, heraldUrl })).rejects.toThrow("launcher_identity_differs");
  expect(mock.join).not.toHaveBeenCalled();
});

it("never exposes an enrolled signer to due launches until the shard grants launcher", async () => {
  await expect(deploy().account(chainId)).rejects.toThrow("launcher_role_not_granted");
  await deploy().enrol({ chainId, heraldUrl });
  mock.launcher.mockResolvedValue(0x99n);
  await expect(deploy().account(chainId)).rejects.toThrow("launcher_role_not_granted");
  mock.launcher.mockResolvedValue(BigInt(own));
  expect(await deploy().account(chainId)).toBe(own);
});
