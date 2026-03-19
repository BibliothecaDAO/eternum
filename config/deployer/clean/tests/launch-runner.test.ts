import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

const grantVillagePassRolesToWorldSystemsMock = mock(async () => ({
  chain: "slot.eternum",
  network: "slot",
  gameName: "alpha",
  rpcUrl: "https://rpc.example",
  worldAddress: "0xworld",
  villagePassAddress: "0xvillagepass",
  realmInternalSystemsAddress: "0xrealm",
  villageSystemsAddress: "0xvillage",
  transactionHash: "0xvillageroles",
  dryRun: false,
  outputPath: "/tmp/village-pass-role.json",
}));

const writeLaunchSummaryMock = mock(() => "/tmp/launch-summary.json");

mock.module("@bibliothecadao/provider", () => ({
  EternumProvider: class EternumProvider {
    provider = {};

    constructor(_manifest: unknown, _rpcUrl: string, _vrfProviderAddress: string) {}
  },
}));

mock.module("@contracts", () => ({
  getGameManifest: () => ({}),
  getSeasonAddresses: () => ({}),
}));

mock.module("../config/config-loader", () => ({
  applyDeploymentConfigOverrides: () => ({}),
  loadEnvironmentConfiguration: () => ({}),
}));

mock.module("../config/steps", () => ({
  resolveFactoryWorldConfigSteps: () => [],
}));

mock.module("../eternum", () => ({
  buildDefaultBanks: () => [],
  grantVillagePassRolesToWorldSystems: grantVillagePassRolesToWorldSystemsMock,
}));

mock.module("../launch/io", () => ({
  loadLaunchSummaryIfPresent: () => null,
  writeLaunchSummary: writeLaunchSummaryMock,
}));

mock.module("../shared/credentials", () => ({
  resolveAccountCredentials: (request: {
    accountAddress?: string;
    privateKey?: string;
    fallbackAccountAddress?: string;
    fallbackPrivateKey?: string;
  }) => ({
    accountAddress: request.accountAddress || request.fallbackAccountAddress || "0xadmin",
    privateKey: request.privateKey || request.fallbackPrivateKey || "0xprivate",
  }),
}));

const { runLaunchStep } = await import("../launch/runner");

describe("runLaunchStep grant-village-pass-role", () => {
  const startTime = 1_700_000_000;
  const accountAddress = "0x1";
  const privateKey = "0x1";

  afterEach(() => {
    grantVillagePassRolesToWorldSystemsMock.mockClear();
    writeLaunchSummaryMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test("runs the village pass role bundle for eternum and stores one tx hash", async () => {
    const summary = await runLaunchStep({
      environmentId: "slot.eternum",
      stepId: "grant-village-pass-role",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      accountAddress,
      privateKey,
    });

    expect(grantVillagePassRolesToWorldSystemsMock).toHaveBeenCalledTimes(1);
    expect(grantVillagePassRolesToWorldSystemsMock.mock.calls[0]?.[0]).toMatchObject({
      chain: "slot.eternum",
      gameName: "alpha",
      rpcUrl: "https://rpc.example",
      accountAddress,
      privateKey,
    });
    expect(summary.villagePassRoleTxHash).toBe("0xvillageroles");
    expect(summary.createBanksTxHash).toBeUndefined();
    expect(summary.outputPath).toBe("/tmp/launch-summary.json");
  });

  test("skips the village pass role bundle for blitz", async () => {
    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "grant-village-pass-role",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      accountAddress,
      privateKey,
    });

    expect(grantVillagePassRolesToWorldSystemsMock).not.toHaveBeenCalled();
    expect(summary.villagePassRoleTxHash).toBeUndefined();
    expect(summary.outputPath).toBe("/tmp/launch-summary.json");
  });
});
