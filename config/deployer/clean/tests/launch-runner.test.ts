import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

const grantVillagePassRolesToWorldSystemsMock = mock(async (options: { chain: string; gameName: string }) => ({
  chain: options.chain,
  network: options.chain.split(".")[0],
  gameName: options.gameName,
  rpcUrl: "https://rpc.example",
  worldAddress: "0xworld",
  villagePassAddress: "0xvillagepass",
  realmInternalSystemsAddress: "0xrealm",
  villageSystemsAddress: "0xvillage",
  transactionHash: "0xvillageroles",
  dryRun: false,
  outputPath: "/tmp/village-pass-role.json",
}));
const syncPaymasterPolicyMock = mock(async (options: { chain: string; gameName: string }) => ({
  chain: options.chain,
  gameName: options.gameName,
  paymasterName: "empire",
  actionCount: 12,
  outputPath: "/tmp/paymaster-actions.json",
  dryRun: false,
  updated: true,
}));
const createBanksMock = mock(async () => ({
  transaction_hash: "0xbanks",
}));
const waitForFactoryWorldProfileMock = mock(async () => ({
  worldAddress: "0xworld",
  contractsBySelector: {},
}));
const writeLaunchSummaryMock = mock(() => "/tmp/launch-summary.json");

mock.module("@bibliothecadao/provider", () => ({
  EternumProvider: class EternumProvider {
    provider = {};

    constructor(_manifest: unknown, _rpcUrl: string, _vrfProviderAddress: string) {}

    async grant_collectible_minter_role() {
      return { transaction_hash: "0xloot" };
    }

    async create_banks() {
      return createBanksMock();
    }
  },
}));

mock.module("@contracts", () => ({
  getGameManifest: () => ({}),
  getSeasonAddresses: () => ({}),
}));

mock.module("../config/config-loader", () => ({
  applyDeploymentConfigOverrides: (config: unknown) => config,
  loadEnvironmentConfiguration: () => ({}),
}));

mock.module("../config/steps", () => ({
  resolveFactoryWorldConfigSteps: () => [],
}));

mock.module("../eternum", () => ({
  buildDefaultBanks: () => [],
  grantVillagePassRolesToWorldSystems: grantVillagePassRolesToWorldSystemsMock,
}));

mock.module("../factory/discovery", () => ({
  isZeroAddress: () => false,
  patchManifestWithFactory: (manifest: unknown) => manifest,
  resolvePrizeDistributionSystemsAddress: () => "0xprize",
  waitForFactoryWorldProfile: waitForFactoryWorldProfileMock,
}));

mock.module("../indexing/indexer", () => ({
  createIndexer: async () => ({
    mode: "workflow",
    workflowRun: {
      htmlUrl: "https://example.com/workflows/1",
    },
  }),
}));

mock.module("../launch/io", () => ({
  loadLaunchSummaryIfPresent: () => null,
  writeLaunchSummary: writeLaunchSummaryMock,
}));

mock.module("../paymaster", () => ({
  syncPaymasterPolicy: syncPaymasterPolicyMock,
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

describe("runLaunchStep mainnet launch steps", () => {
  const startTime = 1_700_000_000;
  const accountAddress = "0x1";
  const privateKey = "0x1";
  const factoryAddress = "0xfactory";

  afterEach(() => {
    grantVillagePassRolesToWorldSystemsMock.mockClear();
    syncPaymasterPolicyMock.mockClear();
    createBanksMock.mockClear();
    waitForFactoryWorldProfileMock.mockClear();
    writeLaunchSummaryMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test("runs the village pass role bundle for mainnet eternum and stores one tx hash", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.eternum",
      stepId: "grant-village-pass-role",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(grantVillagePassRolesToWorldSystemsMock).toHaveBeenCalledTimes(1);
    expect(grantVillagePassRolesToWorldSystemsMock.mock.calls[0]?.[0]).toMatchObject({
      chain: "mainnet.eternum",
      gameName: "alpha",
      rpcUrl: "https://rpc.example",
      accountAddress,
      privateKey,
    });
    expect(summary.villagePassRoleTxHash).toBe("0xvillageroles");
    expect(summary.outputPath).toBe("/tmp/launch-summary.json");
  });

  test("skips the village pass role bundle for mainnet blitz", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "grant-village-pass-role",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(grantVillagePassRolesToWorldSystemsMock).not.toHaveBeenCalled();
    expect(summary.villagePassRoleTxHash).toBeUndefined();
    expect(summary.outputPath).toBe("/tmp/launch-summary.json");
  });

  test("creates banks for mainnet eternum", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.eternum",
      stepId: "create-banks",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(waitForFactoryWorldProfileMock).toHaveBeenCalledTimes(1);
    expect(createBanksMock).toHaveBeenCalledTimes(1);
    expect(summary.createBanksTxHash).toBe("0xbanks");
    expect(summary.worldAddress).toBe("0xworld");
  });

  test("skips banks for mainnet blitz", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "create-banks",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(waitForFactoryWorldProfileMock).toHaveBeenCalledTimes(1);
    expect(createBanksMock).not.toHaveBeenCalled();
    expect(summary.createBanksTxHash).toBeUndefined();
    expect(summary.worldAddress).toBe("0xworld");
  });

  test("syncs paymaster only for mainnet environments", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "sync-paymaster",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
    });

    expect(syncPaymasterPolicyMock).toHaveBeenCalledTimes(1);
    expect(syncPaymasterPolicyMock.mock.calls[0]?.[0]).toMatchObject({
      chain: "mainnet",
      gameName: "alpha",
    });
    expect(summary.paymasterSynced).toBe(true);
  });

  test("skips paymaster sync for slot environments", async () => {
    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "sync-paymaster",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
    });

    expect(syncPaymasterPolicyMock).not.toHaveBeenCalled();
    expect(summary.paymasterSynced).toBeUndefined();
  });
});
