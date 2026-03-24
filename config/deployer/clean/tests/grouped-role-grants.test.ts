import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

const executeMock = mock(async (calls: unknown[]) => ({ transaction_hash: "0xgrouped", calls }));
const waitForTransactionMock = mock(async () => ({ execution_status: "SUCCEEDED" }));
const resolveFactoryWorldProfileMock = mock(async (_chain: string, gameName: string) => ({
  worldAddress: `0xworld-${gameName}`,
  contractsBySelector: {},
}));
const resolveVillagePassRoleGrantTargetMock = mock(async (request: { gameName: string; chain: string }) => ({
  network: request.chain.split(".")[0],
  worldAddress: `0xworld-${request.gameName}`,
  patchedManifest: { worldAddress: `0xworld-${request.gameName}` },
  villagePassAddress: "0xvillagepass",
  realmInternalSystemsAddress: `0xrealm-${request.gameName}`,
  villageSystemsAddress: `0xvillage-${request.gameName}`,
}));

mock.module("starknet", () => ({
  RpcProvider: class RpcProvider {
    constructor(_options: unknown) {}
  },
  Account: class Account {
    constructor(_options: unknown) {}

    execute(calls: unknown[]) {
      return executeMock(calls);
    }

    waitForTransaction(transactionHash: string) {
      return waitForTransactionMock(transactionHash);
    }
  },
  hash: {
    getSelectorFromName(name: string) {
      if (name === "MINTER_ROLE") {
        return "0xminter";
      }

      if (name === "DISTRIBUTOR_ROLE") {
        return "0xdistributor";
      }

      return `0x${name}`;
    },
  },
  shortString: {
    encodeShortString(value: string) {
      return value;
    },
  },
}));

mock.module("@contracts", () => ({
  getGameManifest: () => ({}),
  getSeasonAddresses: () => ({
    "Collectibles: Realms: Loot Chest": "0xloot",
  }),
}));

mock.module("../config/config-loader", () => ({
  loadEnvironmentConfiguration: () => ({}),
  applyDeploymentConfigOverrides: (config: unknown) => config,
}));

mock.module("../factory/discovery", () => ({
  resolveFactoryWorldProfile: resolveFactoryWorldProfileMock,
  waitForFactoryWorldProfile: resolveFactoryWorldProfileMock,
  patchManifestWithFactory: (_manifest: unknown, worldAddress: string) => ({ worldAddress }),
  resolvePrizeDistributionSystemsAddress: (manifest: { worldAddress?: string }) => `0xprize-${manifest.worldAddress}`,
  isZeroAddress: (value?: string | null) => !value || /^0x?0*$/.test(value),
}));

mock.module("../eternum", () => ({
  buildDefaultBanks: () => [],
  buildVillagePassRoleGrantCalls: (target: {
    villagePassAddress: string;
    realmInternalSystemsAddress: string;
    villageSystemsAddress: string;
  }) => [
    {
      contractAddress: target.villagePassAddress,
      entrypoint: "grant_role",
      calldata: ["0xminter", target.realmInternalSystemsAddress],
    },
    {
      contractAddress: target.villagePassAddress,
      entrypoint: "grant_role",
      calldata: ["0xdistributor", target.villageSystemsAddress],
    },
  ],
  grantVillagePassRolesToWorldSystems: async () => ({
    transactionHash: "0xvillage",
  }),
  resolveVillagePassRoleGrantTarget: resolveVillagePassRoleGrantTargetMock,
}));

const { grantLootChestRolesForSeriesLikeGames, grantVillagePassRolesForSeriesLikeGames } =
  await import("../launch/grouped-role-grants");

describe("grouped role grants", () => {
  afterEach(() => {
    executeMock.mockClear();
    waitForTransactionMock.mockClear();
    resolveFactoryWorldProfileMock.mockClear();
    resolveVillagePassRoleGrantTargetMock.mockClear();
  });

  afterAll(() => {
    mock.restore();
  });

  test("submits one grouped loot chest multicall for every eligible game", async () => {
    const transactionHash = await grantLootChestRolesForSeriesLikeGames({
      request: buildSeriesRequest(),
      summary: buildSeriesSummary("slot.blitz"),
      games: buildSeriesGames(),
    });

    expect(transactionHash).toBe("0xgrouped");
    expect(resolveFactoryWorldProfileMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0]?.[0]).toEqual([
      {
        contractAddress: "0xloot",
        entrypoint: "grant_role",
        calldata: ["0xminter", "0xprize-0xworld-bltz-knicker-01"],
      },
      {
        contractAddress: "0xloot",
        entrypoint: "grant_role",
        calldata: ["0xminter", "0xprize-0xworld-bltz-knicker-02"],
      },
    ]);
  });

  test("submits one grouped village pass multicall for every eligible game", async () => {
    const transactionHash = await grantVillagePassRolesForSeriesLikeGames({
      request: buildSeriesRequest({
        environmentId: "slot.eternum",
      }),
      summary: buildSeriesSummary("slot.eternum"),
      games: buildSeriesGames(),
    });

    expect(transactionHash).toBe("0xgrouped");
    expect(resolveVillagePassRoleGrantTargetMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0]?.[0]).toEqual([
      {
        contractAddress: "0xvillagepass",
        entrypoint: "grant_role",
        calldata: ["0xminter", "0xrealm-bltz-knicker-01"],
      },
      {
        contractAddress: "0xvillagepass",
        entrypoint: "grant_role",
        calldata: ["0xdistributor", "0xvillage-bltz-knicker-01"],
      },
      {
        contractAddress: "0xvillagepass",
        entrypoint: "grant_role",
        calldata: ["0xminter", "0xrealm-bltz-knicker-02"],
      },
      {
        contractAddress: "0xvillagepass",
        entrypoint: "grant_role",
        calldata: ["0xdistributor", "0xvillage-bltz-knicker-02"],
      },
    ]);
  });
});

function buildSeriesRequest(overrides: Record<string, unknown> = {}) {
  return {
    launchKind: "series",
    environmentId: "slot.blitz",
    seriesName: "bltz-knicker",
    rpcUrl: "https://rpc.example",
    accountAddress: "0xadmin",
    privateKey: "0xprivate",
    games: [
      { gameName: "bltz-knicker-01", startTime: "2026-03-23T10:00:00Z" },
      { gameName: "bltz-knicker-02", startTime: "2026-03-23T11:00:00Z" },
    ],
    ...overrides,
  };
}

function buildSeriesSummary(environment: "slot.blitz" | "slot.eternum") {
  return {
    environment,
    chain: environment.startsWith("slot") ? "slot" : "mainnet",
    gameType: environment.endsWith(".blitz") ? "blitz" : "eternum",
    seriesName: "bltz-knicker",
    rpcUrl: "https://rpc.example",
    factoryAddress: "0xfactory",
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    dryRun: false,
    configMode: "batched" as const,
    seriesCreated: true,
    games: buildSeriesGames(),
  };
}

function buildSeriesGames() {
  return [
    {
      gameName: "bltz-knicker-01",
      startTime: 1,
      startTimeIso: "2026-03-23T10:00:00.000Z",
      seriesGameNumber: 1,
      currentStepId: null,
      latestEvent: "Configured",
      status: "succeeded" as const,
      configSteps: [],
      steps: [],
      artifacts: {},
    },
    {
      gameName: "bltz-knicker-02",
      startTime: 2,
      startTimeIso: "2026-03-23T11:00:00.000Z",
      seriesGameNumber: 2,
      currentStepId: null,
      latestEvent: "Configured",
      status: "succeeded" as const,
      configSteps: [],
      steps: [],
      artifacts: {},
    },
  ];
}
