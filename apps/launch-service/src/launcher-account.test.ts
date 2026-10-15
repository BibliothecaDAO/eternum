import { beforeEach, expect, it, vi } from "vitest";
import { botRealmsId, realmsAccountAddress } from "@realms-world/identity/account";
import { shortString } from "starknet";
import { LAUNCHER_LABEL, seaterLabels } from "@realms-world/value-ledger";
import { joinBotAccount } from "./launcher-account";
const mock = vi.hoisted(() => ({
  manifest: vi.fn(),
  chain: vi.fn(),
  join: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: mock.chain }),
}));
vi.mock("./executor", () => ({ readLaunchShard: mock.manifest }));
vi.mock("@bibliothecadao/eternum/realms-account", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum/realms-account")>()),
  joinRealmsAccount: mock.join,
  deviceKeyOf: () => ({ privateKey: "0x1", publicKey: "0x2" }),
}));
const chainId = "0x1",
  heraldUrl = "https://shard.test";
const own = realmsAccountAddress(botRealmsId(shortString.encodeShortString("ETERNUM_LAUNCHER")), "0x2", "0x9");
const env = {
  IDENTITY: { shards: async () => [{ chainId, url: heraldUrl, status: "active" as const }] },
  BASE_URL: "https://app.test",
  LAUNCH_DEPLOYER_PRIVATE_KEY: "0x1",
  OPERATOR_TOKEN: "test",
  IDENTITY_HTTP: { fetch: vi.fn(async () => Response.json({ accountClassHash: "0x2", publicKey: "0x9" })) },
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.chain.mockResolvedValue("0x1");
  mock.manifest.mockResolvedValue({
    shard: {
      url: heraldUrl,
      status: "active",
      chainId,
      accountClassHash: "0x2",
      guardianPublicKey: "0x9",
      rpcUrl: heraldUrl + "/rpc",
      contracts: { games: "0x77" },
    },
  });
  mock.join.mockResolvedValue({ address: own });
});
it("joins the fixed launcher on every alarm without a deployment record", async () => {
  expect(await joinBotAccount(env as never, chainId, LAUNCHER_LABEL)).toBe(own);
  expect(mock.join.mock.calls[0][0]).toMatchObject({
    shard: { accountClassHash: "0x2", guardianPublicKey: "0x9" },
    realmsId: botRealmsId(shortString.encodeShortString("ETERNUM_LAUNCHER")),
  });
  expect(await joinBotAccount(env as never, chainId, LAUNCHER_LABEL)).toBe(own);
  expect(mock.join).toHaveBeenCalledTimes(2);
  mock.manifest.mockRejectedValueOnce(new Error("unlisted_shard"));
  await expect(joinBotAccount(env as never, "0x2", LAUNCHER_LABEL)).rejects.toThrow("unlisted_shard");
});
it("joins a seater as its own bot account, approved under its own label", async () => {
  await joinBotAccount(env as never, chainId, seaterLabels[3]!);
  expect(mock.join.mock.calls[0][0]).toMatchObject({
    realmsId: botRealmsId(shortString.encodeShortString("ETERNUM_SEATER_3")),
  });
  await mock.join.mock.calls[0][0].approve({ counter: 1 });
  const [, approval] = env.IDENTITY_HTTP.fetch.mock.calls.at(-1) as unknown as [string, RequestInit];
  expect(JSON.parse(String(approval.body))).toMatchObject({
    label: shortString.encodeShortString("ETERNUM_SEATER_3"),
    counter: 1,
  });
});
it("reports an approval's HTTP status and fixed service code", async () => {
  await joinBotAccount(env as never, chainId, LAUNCHER_LABEL);
  env.IDENTITY_HTTP.fetch.mockResolvedValueOnce(Response.json({ error: "guardian_unavailable" }, { status: 503 }));
  await expect(mock.join.mock.calls[0][0].approve({})).rejects.toThrow(
    "launcher_approval_refused: HTTP 503; code guardian_unavailable",
  );
});
