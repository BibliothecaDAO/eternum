import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

const createGameTransactionHashes = ["0xcreate1", "0xcreate2", "0xcreate3"];
const createGameDelayMock = mock(async (_delayMs: number) => undefined);
let createGameExecuteCount = 0;
const createGameExecuteMock = mock(async () => {
  const transactionHash =
    createGameTransactionHashes[createGameExecuteCount] || `0xcreate${createGameExecuteCount + 1}`;
  createGameExecuteCount += 1;

  return { transaction_hash: transactionHash };
});
const waitForTransactionMock = mock(async () => ({ execution_status: "SUCCEEDED" }));
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
const resolveFactoryWorldProfileMock = mock(async () => null);
const writeLaunchSummaryMock = mock(() => "/tmp/launch-summary.json");
const resolveFactoryWorldConfigStepsMock = mock(() => []);
const executeConfigStepsMock = mock(async ({ mode }: { mode?: string }) => ({
  mode: mode || "batched",
  steps: [],
  transactionHash: mode === "batched" ? "0xconfigure" : undefined,
}));

function buildQueuedConfigStep(id: string, queuedCallCount: number) {
  return {
    id,
    description: id,
    execute: async (context: {
      account: unknown;
      provider: { executeAndCheckTransaction: (signer: unknown, details: unknown[]) => Promise<unknown> };
    }) => {
      await context.provider.executeAndCheckTransaction(
        context.account,
        Array.from({ length: queuedCallCount }, (_value, index) => ({
          contractAddress: "0xconfig",
          entrypoint: `${id}-${index}`,
          calldata: [],
        })),
      );
    },
  };
}

mock.module("@bibliothecadao/provider", () => ({
  EternumProvider: class EternumProvider {
    provider = {};
    private queuedBatchCallCount = 0;

    constructor(_manifest: unknown, _rpcUrl: string, _vrfProviderAddress: string) {}

    beginBatch() {
      this.queuedBatchCallCount = 0;
    }

    async endBatch() {
      this.queuedBatchCallCount = 0;
      return { transaction_hash: "0xbatch" };
    }

    getQueuedBatchCallCount() {
      return this.queuedBatchCallCount;
    }

    async executeAndCheckTransaction(_signer: unknown, details: unknown) {
      const calls = Array.isArray(details) ? details : [details];
      this.queuedBatchCallCount += calls.length;
      return { statusReceipt: "QUEUED_FOR_BATCH" };
    }

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

mock.module("node:timers/promises", () => ({
  setTimeout: createGameDelayMock,
}));

mock.module("starknet", () => ({
  Account: class Account {
    constructor(_options: unknown) {}

    async execute(call: unknown) {
      return createGameExecuteMock(call);
    }

    async waitForTransaction(transactionHash: string) {
      return waitForTransactionMock(transactionHash);
    }
  },
  RpcProvider: class RpcProvider {
    constructor(_options: unknown) {}
  },
  shortString: {
    encodeShortString: (value: string) => `felt:${value}`,
  },
}));

mock.module("../config/config-loader", () => ({
  applyDeploymentConfigOverrides: (config: unknown) => config,
  loadEnvironmentConfiguration: () => ({}),
}));

mock.module("../config/executor", () => ({
  executeConfigSteps: executeConfigStepsMock,
}));

mock.module("../config/steps", () => ({
  resolveFactoryWorldConfigSteps: resolveFactoryWorldConfigStepsMock,
}));

mock.module("../eternum", () => ({
  buildDefaultBanks: () => [],
  grantVillagePassRolesToWorldSystems: grantVillagePassRolesToWorldSystemsMock,
}));

mock.module("../factory/discovery", () => ({
  isZeroAddress: () => false,
  patchManifestWithFactory: (manifest: unknown) => manifest,
  resolvePrizeDistributionSystemsAddress: () => "0xprize",
  resolveFactoryWorldProfile: resolveFactoryWorldProfileMock,
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
    createGameDelayMock.mockClear();
    createGameExecuteMock.mockClear();
    createGameExecuteCount = 0;
    waitForTransactionMock.mockClear();
    grantVillagePassRolesToWorldSystemsMock.mockClear();
    syncPaymasterPolicyMock.mockClear();
    createBanksMock.mockClear();
    waitForFactoryWorldProfileMock.mockClear();
    resolveFactoryWorldProfileMock.mockClear();
    writeLaunchSummaryMock.mockClear();
    resolveFactoryWorldConfigStepsMock.mockClear();
    resolveFactoryWorldConfigStepsMock.mockImplementation(() => []);
    executeConfigStepsMock.mockClear();
    executeConfigStepsMock.mockImplementation(async ({ mode }: { mode?: string }) => ({
      mode: mode || "batched",
      steps: [],
      transactionHash: mode === "batched" ? "0xconfigure" : undefined,
    }));
  });

  afterAll(() => {
    mock.restore();
  });

  test("submits create_game fifteen times on mainnet with legacy triple-submit across five retries", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "create-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(createGameExecuteMock).toHaveBeenCalledTimes(15);
    expect(createGameExecuteMock.mock.calls[0]?.[0]).toEqual({
      contractAddress: factoryAddress,
      entrypoint: "create_game",
      calldata: ["felt:alpha", 70, "180", "0x0", 0],
    });
    expect(waitForTransactionMock.mock.calls).toHaveLength(15);
    expect(createGameDelayMock.mock.calls).toHaveLength(14);
    expect(summary.createGameTxHash).toBe("0xcreate15");
  });

  test("submits create_game five times on slot across five retries", async () => {
    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "create-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(createGameExecuteMock).toHaveBeenCalledTimes(5);
    expect(createGameExecuteMock.mock.calls[0]?.[0]).toEqual({
      contractAddress: factoryAddress,
      entrypoint: "create_game",
      calldata: ["felt:alpha", 300, "180", "0x0", 0],
    });
    expect(waitForTransactionMock.mock.calls).toHaveLength(5);
    expect(createGameDelayMock).not.toHaveBeenCalled();
    expect(summary.createGameTxHash).toBe("0xcreate5");
  });

  test("skips create_game when factory SQL already shows the world before the first attempt", async () => {
    resolveFactoryWorldProfileMock.mockImplementationOnce(async () => ({
      worldAddress: "0xexistingworld",
      contractsBySelector: {},
    }));

    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "create-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(createGameExecuteMock).not.toHaveBeenCalled();
    expect(summary.worldAddress).toBe("0xexistingworld");
    expect(summary.createGameTxHash).toBeUndefined();
  });

  test("stops create_game retries once factory SQL shows the world", async () => {
    resolveFactoryWorldProfileMock
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({
        worldAddress: "0xexistingworld",
        contractsBySelector: {},
      }));

    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "create-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(createGameExecuteMock).toHaveBeenCalledTimes(1);
    expect(waitForTransactionMock).toHaveBeenCalledTimes(1);
    expect(summary.worldAddress).toBe("0xexistingworld");
    expect(summary.createGameTxHash).toBe("0xcreate1");
  });

  test("treats an already completed create_game as success when factory SQL already shows the world", async () => {
    createGameExecuteMock.mockImplementationOnce(async () => {
      throw new Error("deployment already completed");
    });
    resolveFactoryWorldProfileMock
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({
        worldAddress: "0xexistingworld",
        contractsBySelector: {},
      }));

    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "create-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(resolveFactoryWorldProfileMock).toHaveBeenCalledWith("slot", "alpha", "https://api.cartridge.gg");
    expect(summary.worldAddress).toBe("0xexistingworld");
    expect(summary.createGameTxHash).toBeUndefined();
  });

  test("keeps failing create_game when the duplicate message cannot be verified in factory SQL", async () => {
    createGameExecuteMock.mockImplementationOnce(async () => {
      throw new Error("deployment already completed");
    });
    resolveFactoryWorldProfileMock.mockImplementationOnce(async () => null).mockImplementationOnce(async () => null);

    await expect(
      runLaunchStep({
        environmentId: "slot.blitz",
        stepId: "create-world",
        gameName: "alpha",
        startTime,
        rpcUrl: "https://rpc.example",
        factoryAddress,
        accountAddress,
        privateKey,
      }),
    ).rejects.toThrow("deployment already completed");

    expect(resolveFactoryWorldProfileMock).toHaveBeenCalledWith("slot", "alpha", "https://api.cartridge.gg");
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

  test("keeps subdividing configure-world batches after another batched mainnet failure", async () => {
    resolveFactoryWorldConfigStepsMock.mockImplementation(() => [
      buildQueuedConfigStep("world-admin", 2),
      buildQueuedConfigStep("tick", 3),
      buildQueuedConfigStep("map", 2),
      buildQueuedConfigStep("resource-factory", 3),
    ]);

    let invocationCount = 0;
    executeConfigStepsMock.mockImplementation(
      async ({ mode, steps }: { mode?: string; steps?: Array<{ id: string }> }) => {
        invocationCount += 1;
        const stepIds = (steps || []).map((step) => step.id);
        if (
          invocationCount === 1 ||
          (stepIds.length === 2 && stepIds[0] === "map" && stepIds[1] === "resource-factory")
        ) {
          throw new Error("RPC: starknet_addInvokeTransaction failed");
        }

        return {
          mode: mode || "batched",
          steps: (steps || []).map((step) => ({ id: step.id, description: step.id })),
          transactionHash: `0xconfigure${invocationCount}`,
        };
      },
    );

    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "configure-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(
      executeConfigStepsMock.mock.calls.map(([input]) => ({
        mode: input.mode,
        stepIds: input.steps.map((step: { id: string }) => step.id),
      })),
    ).toEqual([
      { mode: "batched", stepIds: ["world-admin", "tick", "map", "resource-factory"] },
      { mode: "batched", stepIds: ["world-admin", "tick"] },
      { mode: "batched", stepIds: ["map", "resource-factory"] },
      { mode: "batched", stepIds: ["map"] },
      { mode: "batched", stepIds: ["resource-factory"] },
    ]);
    expect(summary.configMode).toBe("batched");
    expect(summary.configureTxHash).toBe("0xconfigure5");
    expect(summary.configSteps).toEqual([
      { id: "world-admin", description: "world-admin" },
      { id: "tick", description: "tick" },
      { id: "map", description: "map" },
      { id: "resource-factory", description: "resource-factory" },
    ]);
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
