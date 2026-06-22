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
const loadLaunchSummaryIfPresentMock = mock(() => null);
const resolveFactoryWorldConfigStepsMock = mock(() => []);
const getGameManifestMock = mock(() => ({}));
const loadEnvironmentConfigurationMock = mock(() => ({}));
const applyDeploymentConfigOverridesMock = mock((config: unknown) => config);
const executeConfigStepsMock = mock(async ({ mode }: { mode?: string }) => ({
  mode: mode || "batched",
  steps: [],
  transactionHash: mode === "batched" ? "0xconfigure" : undefined,
  artifacts: {},
}));
const deriveMapCenterOffsetFromWorldConfigTxMock = mock(() => 50);
const buildBanksForMapCenterOffsetMock = mock(() => []);
const ensureIndexerDeploymentMock = mock(async () => ({
  mode: "aws-ecs",
  action: "created",
  requestedTier: "basic",
  previousTier: undefined,
  liveState: {
    provider: "aws",
    runtimeKind: "torii",
    runtimeName: "bltz-test",
    serviceName: "slot-blitz-torii-bltz-test",
    status: "existing",
    endpointUrl: "https://torii.example",
    tier: "basic",
    version: "v1.8.15",
    region: "us-east-1",
    describedAt: "2026-03-23T10:00:00.000Z",
  },
}));

mock.module("@bibliothecadao/provider", () => ({
  NAMESPACE: "s1_eternum",
  getContractByName: (manifest: { contracts?: Array<{ tag?: string; address?: string }> }, tag: string) => {
    const contract = manifest.contracts?.find((entry) => entry.tag === tag);
    if (!contract?.address) {
      throw new Error(`Contract ${tag} not found in test manifest`);
    }

    return contract.address;
  },
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
  getGameManifest: getGameManifestMock,
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
  CallData: {
    compile: (value: unknown) => value,
  },
  constants: {
    LegacyUDC: {
      ADDRESS: "0xudc",
    },
  },
  hash: {
    computePedersenHash: (_left: string, _right: string) => "0xsalt",
    calculateContractAddressFromHash: () => "0x55587061e1f470c749e9f7e568a3eb8b8d2335ac2c9b5adf8d9669fb378b38",
    getSelectorFromName: (value: string) => `selector:${value}`,
  },
  shortString: {
    encodeShortString: (value: string) => `felt:${value}`,
  },
}));

mock.module("../config/config-loader", () => ({
  applyDeploymentConfigOverrides: applyDeploymentConfigOverridesMock,
  loadEnvironmentConfiguration: loadEnvironmentConfigurationMock,
}));

mock.module("../config/executor", () => ({
  executeConfigSteps: executeConfigStepsMock,
}));

mock.module("../config/steps", () => ({
  resolveFactoryWorldConfigSteps: resolveFactoryWorldConfigStepsMock,
}));

mock.module("../eternum", () => ({
  buildBanksForMapCenterOffset: buildBanksForMapCenterOffsetMock,
  deriveMapCenterOffsetFromWorldConfigTx: deriveMapCenterOffsetFromWorldConfigTxMock,
  grantVillagePassRolesToWorldSystems: grantVillagePassRolesToWorldSystemsMock,
}));

function resolveMockManifestAddress(
  manifest: { contracts?: { tag?: string; address?: string }[] },
  exactTag: string,
  suffix: string,
  fallback: string,
): string {
  return (
    manifest.contracts?.find((contract) => contract.tag === exactTag)?.address ||
    manifest.contracts?.find((contract) => contract.tag?.endsWith(suffix))?.address ||
    fallback
  );
}

mock.module("../factory/discovery", () => ({
  isZeroAddress: () => false,
  patchManifestWithFactory: (manifest: unknown) => manifest,
  resolvePrizeDistributionSystemsAddress: () => "0xprize",
  resolveVillageSystemsAddress: (manifest: { contracts?: { tag?: string; address?: string }[] }) =>
    resolveMockManifestAddress(manifest, "s1_eternum-village_systems", "-village_systems", "0xvillage"),
  resolveFactoryWorldProfile: resolveFactoryWorldProfileMock,
  waitForFactoryWorldProfile: waitForFactoryWorldProfileMock,
}));

mock.module("../runtime/indexer-provider", () => ({
  ensureIndexerDeployment: ensureIndexerDeploymentMock,
  resolveIndexerArtifactStateFromProvider: (result: {
    mode: string;
    requestedTier?: string;
    liveState: {
      status?: string;
      tier?: string;
      endpointUrl?: string;
      version?: string;
      describedAt?: string;
    };
  }) => ({
    indexerCreated: result.liveState.status === "existing",
    indexerMode: result.mode,
    indexerTier: result.liveState.tier || result.requestedTier,
    indexerUrl: result.liveState.endpointUrl,
    indexerVersion: result.liveState.version,
    indexerBranch: undefined,
    lastIndexerDescribeAt: result.liveState.describedAt,
    runtimeProvider: "aws",
    awsRuntime: {
      provider: "aws",
      runtimeKind: "torii",
      runtimeName: "bltz-test",
      serviceName: "slot-blitz-torii-bltz-test",
      endpointUrl: result.liveState.endpointUrl,
    },
  }),
}));

mock.module("../launch/io", () => ({
  loadLaunchSummaryIfPresent: loadLaunchSummaryIfPresentMock,
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
    loadLaunchSummaryIfPresentMock.mockClear();
    loadLaunchSummaryIfPresentMock.mockImplementation(() => null);
    resolveFactoryWorldConfigStepsMock.mockClear();
    resolveFactoryWorldConfigStepsMock.mockImplementation(() => []);
    getGameManifestMock.mockClear();
    getGameManifestMock.mockImplementation(() => ({}));
    loadEnvironmentConfigurationMock.mockClear();
    loadEnvironmentConfigurationMock.mockImplementation(() => ({}));
    applyDeploymentConfigOverridesMock.mockClear();
    applyDeploymentConfigOverridesMock.mockImplementation((config: unknown) => config);
    executeConfigStepsMock.mockClear();
    executeConfigStepsMock.mockImplementation(async ({ mode }: { mode?: string }) => ({
      mode: mode || "batched",
      steps: [],
      transactionHash: mode === "batched" ? "0xconfigure" : undefined,
      artifacts: {},
    }));
    deriveMapCenterOffsetFromWorldConfigTxMock.mockClear();
    deriveMapCenterOffsetFromWorldConfigTxMock.mockImplementation(() => 50);
    buildBanksForMapCenterOffsetMock.mockClear();
    buildBanksForMapCenterOffsetMock.mockImplementation(() => []);
    ensureIndexerDeploymentMock.mockClear();
    ensureIndexerDeploymentMock.mockImplementation(async () => ({
      mode: "aws-ecs",
      action: "created",
      requestedTier: "basic",
      previousTier: undefined,
      liveState: {
        provider: "aws",
        runtimeKind: "torii",
        runtimeName: "alpha",
        serviceName: "slot-blitz-torii-alpha",
        status: "existing",
        endpointUrl: "https://torii.example",
        tier: "basic",
        version: "v1.8.15",
        region: "us-east-1",
        describedAt: "2026-03-23T10:00:00.000Z",
      },
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
      calldata: ["felt:alpha", 50, "140", "0x0", 0],
    });
    expect(waitForTransactionMock.mock.calls).toHaveLength(15);
    expect(createGameDelayMock.mock.calls).toHaveLength(14);
    expect(summary.createGameTxHash).toBe("0xcreate15");
  });

  test("logs raw create_game calldata before each submission attempt", async () => {
    const capturedLogs: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);

    process.stderr.write = ((chunk: string | Uint8Array) => {
      capturedLogs.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;

    try {
      await runLaunchStep({
        environmentId: "mainnet.blitz",
        stepId: "create-world",
        gameName: "alpha",
        startTime,
        rpcUrl: "https://rpc.example",
        factoryAddress,
        accountAddress,
        privateKey,
      });
    } finally {
      process.stderr.write = originalWrite;
    }

    expect(capturedLogs.join("")).toContain('Raw create_game calldata: ["felt:alpha",50,"140","0x0",0]');
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
      calldata: ["felt:alpha", 300, "140", "0x0", 0],
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
    loadLaunchSummaryIfPresentMock.mockImplementation(() =>
      buildStoredLaunchSummary({
        environment: "mainnet.eternum",
        chain: "mainnet",
        gameType: "eternum",
        worldConfigTxHash: "0xstored-world-config",
      }),
    );

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
    expect(deriveMapCenterOffsetFromWorldConfigTxMock).toHaveBeenCalledWith("0xstored-world-config");
    expect(buildBanksForMapCenterOffsetMock).toHaveBeenCalledWith(50);
    expect(summary.createBanksTxHash).toBe("0xbanks");
    expect(summary.worldAddress).toBe("0xworld");
  });

  test("stores the batched configure tx hash as worldConfigTxHash", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.eternum",
      stepId: "configure-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(summary.configureTxHash).toBe("0xconfigure");
    expect(summary.worldConfigTxHash).toBe("0xconfigure");
  });

  test("stores the computed blitz entry token address after configure-world", async () => {
    getGameManifestMock.mockImplementation(() => ({
      contracts: [
        { tag: "s1_eternum-blitz_realm_systems", address: "0x111" },
        { tag: "s1_eternum-config_systems", address: "0x222" },
      ],
    }));
    loadEnvironmentConfigurationMock.mockImplementation(() => ({
      blitz: {
        mode: { on: true },
        registration: {
          fee_amount: "1",
          entry_token_class_hash: "0x123",
        },
      },
    }));
    executeConfigStepsMock.mockImplementationOnce(async () => ({
      mode: "batched",
      steps: [{ id: "blitz-registration", description: "Set blitz registration config" }],
      transactionHash: "0xabc",
      artifacts: {},
    }));

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

    expect(summary.entryTokenAddress).toBe("0x55587061e1f470c749e9f7e568a3eb8b8d2335ac2c9b5adf8d9669fb378b38");
  });

  test("reserves blitz hyperstructures in one fixed-size call when one batch is enough", async () => {
    getGameManifestMock.mockImplementation(() => ({
      contracts: [{ tag: "s1_eternum-hyperstructure_create_systems", address: "0xhyper" }],
    }));
    loadEnvironmentConfigurationMock.mockImplementation(() => ({
      blitz: {
        mode: { on: true },
        registration: {
          registration_count_max: 24,
        },
      },
      settlement: {
        two_player_mode: false,
      },
    }));
    createGameExecuteMock.mockImplementationOnce(async () => ({ transaction_hash: "0xreserve1" }));

    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "reserve-blitz-hyperstructures",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(createGameExecuteMock).toHaveBeenCalledTimes(1);
    expect(createGameExecuteMock.mock.calls[0]?.[0]).toMatchObject({
      contractAddress: "0xhyper",
      entrypoint: "reserve_hyperstructures",
    });
    expect(waitForTransactionMock).toHaveBeenCalledWith("0xreserve1");
    expect(createGameDelayMock).not.toHaveBeenCalled();
    expect(summary.reserveHyperstructuresTxHashes).toEqual(["0xreserve1"]);
  });

  test("waits ten seconds between fixed-size blitz reservation batches when multiple calls are needed", async () => {
    getGameManifestMock.mockImplementation(() => ({
      contracts: [{ tag: "s1_eternum-hyperstructure_create_systems", address: "0xhyper" }],
    }));
    loadEnvironmentConfigurationMock.mockImplementation(() => ({
      blitz: {
        mode: { on: true },
        registration: {
          registration_count_max: 60,
        },
      },
      settlement: {
        two_player_mode: false,
      },
    }));
    createGameExecuteMock
      .mockImplementationOnce(async () => ({ transaction_hash: "0xreserve1" }))
      .mockImplementationOnce(async () => ({ transaction_hash: "0xreserve2" }))
      .mockImplementationOnce(async () => ({ transaction_hash: "0xreserve3" }))
      .mockImplementationOnce(async () => ({ transaction_hash: "0xreserve4" }));

    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "reserve-blitz-hyperstructures",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(createGameExecuteMock).toHaveBeenCalledTimes(4);
    expect(createGameDelayMock.mock.calls).toEqual([[10_000], [10_000], [10_000]]);
    expect(summary.reserveHyperstructuresTxHashes).toEqual(["0xreserve1", "0xreserve2", "0xreserve3", "0xreserve4"]);
  });

  test("stores the sequential world-admin tx hash as worldConfigTxHash", async () => {
    executeConfigStepsMock.mockImplementationOnce(async () => ({
      mode: "sequential",
      steps: [
        {
          id: "world-admin",
          description: "Set world admin config",
          transactionHash: "0xworld-admin",
        },
      ],
      transactionHash: undefined,
      artifacts: {
        worldConfigTxHash: "0xworld-admin",
      },
    }));

    const summary = await runLaunchStep({
      environmentId: "mainnet.eternum",
      stepId: "configure-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
      executionMode: "sequential",
    });

    expect(summary.configureTxHash).toBeUndefined();
    expect(summary.worldConfigTxHash).toBe("0xworld-admin");
    expect(summary.configSteps).toEqual([
      {
        id: "world-admin",
        description: "Set world admin config",
        transactionHash: "0xworld-admin",
      },
    ]);
  });

  test("creates the indexer through the configured runtime provider and stores AWS runtime state", async () => {
    const summary = await runLaunchStep({
      environmentId: "slot.blitz",
      stepId: "create-indexer",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
    });

    expect(ensureIndexerDeploymentMock).toHaveBeenCalledTimes(1);
    expect(ensureIndexerDeploymentMock.mock.calls[0]?.[0]).toMatchObject({
      env: "slot",
      environmentId: "slot.blitz",
      runtimeProvider: "aws",
      runtimeDomain: "runtime.realms.world",
      rpcUrl: "https://rpc.example",
      namespaces: "s1_eternum",
      worldName: "alpha",
      worldAddress: "0xworld",
      tier: "basic",
    });
    expect(summary.indexerCreated).toBe(true);
    expect(summary.indexerMode).toBe("aws-ecs");
    expect(summary.indexerTier).toBe("basic");
    expect(summary.indexerUrl).toBe("https://torii.example");
    expect(summary.indexerVersion).toBe("v1.8.15");
    expect(summary.indexerBranch).toBeUndefined();
    expect(summary.lastIndexerDescribeAt).toBe("2026-03-23T10:00:00.000Z");
    expect(summary.runtimeProvider).toBe("aws");
    expect(summary.awsRuntime).toMatchObject({
      provider: "aws",
      runtimeKind: "torii",
      endpointUrl: "https://torii.example",
    });
    expect(summary.indexerWorkflowRun).toBeUndefined();
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

  test("fails configure-world immediately after a batched mainnet config error", async () => {
    resolveFactoryWorldConfigStepsMock.mockImplementation(() => [
      { id: "world-admin", description: "world-admin" },
      { id: "tick", description: "tick" },
      { id: "map", description: "map" },
      { id: "resource-factory", description: "resource-factory" },
    ]);

    executeConfigStepsMock.mockImplementation(async () => {
      throw new Error("RPC: starknet_addInvokeTransaction failed");
    });

    await expect(
      runLaunchStep({
        environmentId: "mainnet.blitz",
        stepId: "configure-world",
        gameName: "alpha",
        startTime,
        rpcUrl: "https://rpc.example",
        factoryAddress,
        accountAddress,
        privateKey,
      }),
    ).rejects.toThrow("RPC: starknet_addInvokeTransaction failed");

    expect(executeConfigStepsMock).toHaveBeenCalledTimes(1);
    expect(
      executeConfigStepsMock.mock.calls.map(([input]) => ({
        mode: input.mode,
        stepIds: input.steps.map((step: { id: string }) => step.id),
      })),
    ).toEqual([{ mode: "batched", stepIds: ["world-admin", "tick", "map", "resource-factory"] }]);
  });

  test("skips configure-world when stored run state already marked it succeeded", async () => {
    const summary = await runLaunchStep({
      environmentId: "mainnet.blitz",
      stepId: "configure-world",
      gameName: "alpha",
      startTime,
      rpcUrl: "https://rpc.example",
      factoryAddress,
      accountAddress,
      privateKey,
      resumeSteps: [{ id: "configure-world", status: "succeeded", latestEvent: "World configuration completed" }],
    });

    expect(waitForFactoryWorldProfileMock).toHaveBeenCalledTimes(1);
    expect(executeConfigStepsMock).not.toHaveBeenCalled();
    expect(summary.worldAddress).toBe("0xworld");
    expect(summary.configureTxHash).toBeUndefined();
  });

  test("syncs paymaster only for mainnet environments", async () => {
    loadLaunchSummaryIfPresentMock.mockImplementation(() =>
      buildStoredLaunchSummary({
        entryTokenAddress: "0xentry",
      }),
    );

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
      extraActions: [{ contractAddress: "0xentry", entrypoint: "set_approval_for_all" }],
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

function buildStoredLaunchSummary(overrides: Record<string, unknown> = {}) {
  return {
    environment: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    gameName: "alpha",
    startTime: 1_700_000_000,
    startTimeIso: "2023-11-14T22:13:20.000Z",
    rpcUrl: "https://rpc.example",
    factoryAddress: "0xfactory",
    indexerCreated: false,
    configMode: "batched",
    configSteps: [],
    dryRun: false,
    ...overrides,
  };
}
