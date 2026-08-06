// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (turns: number) => {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
};

const mocks = vi.hoisted(() => ({
  fetchWorldAddress: vi.fn(),
  fetch: vi.fn(),
  getFactorySqlBaseUrl: vi.fn(),
  isRpcUrlCompatibleForChain: vi.fn(),
  normalizeRpcUrl: vi.fn(),
  recordGameEntryDuration: vi.fn(),
  resolveWorldContracts: vi.fn(),
  resolveWorldDeploymentFromFactory: vi.fn(),
  saveWorldProfile: vi.fn(),
  SqlApi: vi.fn(),
}));

vi.mock("@bibliothecadao/torii", () => ({
  SqlApi: mocks.SqlApi.mockImplementation(() => ({
    fetchWorldAddress: mocks.fetchWorldAddress,
  })),
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_CARTRIDGE_API_BASE: "https://api.cartridge.gg",
    VITE_PUBLIC_NODE_URL: "https://fallback-rpc.example",
  },
  hasPublicNodeUrl: true,
}));

vi.mock("./factory-endpoints", () => ({
  getFactorySqlBaseUrl: mocks.getFactorySqlBaseUrl,
}));

vi.mock("./factory-resolver", () => ({
  resolveWorldContracts: mocks.resolveWorldContracts,
  resolveWorldDeploymentFromFactory: mocks.resolveWorldDeploymentFromFactory,
}));

vi.mock("./normalize", () => ({
  isRpcUrlCompatibleForChain: mocks.isRpcUrlCompatibleForChain,
  normalizeRpcUrl: mocks.normalizeRpcUrl,
}));

vi.mock("./store", () => ({
  saveWorldProfile: mocks.saveWorldProfile,
}));

vi.mock("@/ui/layouts/game-entry-timeline", () => ({
  recordGameEntryDuration: mocks.recordGameEntryDuration,
}));

import { buildWorldProfile } from "./profile-builder";

describe("buildWorldProfile concurrency", () => {
  beforeEach(() => {
    mocks.fetchWorldAddress.mockReset();
    mocks.fetch.mockReset();
    mocks.getFactorySqlBaseUrl.mockReset();
    mocks.isRpcUrlCompatibleForChain.mockReset();
    mocks.normalizeRpcUrl.mockReset();
    mocks.recordGameEntryDuration.mockReset();
    mocks.resolveWorldContracts.mockReset();
    mocks.resolveWorldDeploymentFromFactory.mockReset();
    mocks.saveWorldProfile.mockReset();
    mocks.SqlApi.mockClear();
    mocks.getFactorySqlBaseUrl.mockReturnValue("https://factory.example/sql");
    mocks.isRpcUrlCompatibleForChain.mockReturnValue(true);
    mocks.normalizeRpcUrl.mockImplementation((value: string) => value);
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("starts contract and deployment resolution before awaiting either result", async () => {
    const contractsLookup = deferred<Record<string, string>>();
    const deploymentLookup = deferred<{ worldAddress: string; rpcUrl: string }>();

    mocks.resolveWorldContracts.mockReturnValue(contractsLookup.promise);
    mocks.resolveWorldDeploymentFromFactory.mockReturnValue(deploymentLookup.promise);
    mocks.fetchWorldAddress.mockResolvedValue("0x1");
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ entry_token_address: "0x2", fee_token: "0x3" }],
    });

    const profilePromise = buildWorldProfile("mainnet", "mainnet-king-1");

    expect(mocks.resolveWorldContracts).toHaveBeenCalledTimes(1);
    expect(mocks.resolveWorldDeploymentFromFactory).toHaveBeenCalledTimes(1);

    contractsLookup.resolve({ spawn: "0xabc" });
    deploymentLookup.resolve({ worldAddress: "0xdef", rpcUrl: "https://rpc.example" });

    await expect(profilePromise).resolves.toMatchObject({
      contractsBySelector: { spawn: "0xabc" },
      worldAddress: "0x1",
    });
  });

  it("starts world-address and config fetches before awaiting either remote result", async () => {
    const worldAddressLookup = deferred<string>();
    const configLookup = deferred<{ ok: boolean; json: () => Promise<Record<string, unknown>[]> }>();

    mocks.resolveWorldContracts.mockResolvedValue({ spawn: "0xabc" });
    mocks.resolveWorldDeploymentFromFactory.mockResolvedValue({
      worldAddress: "0xdef",
      rpcUrl: "https://rpc.example",
    });
    mocks.fetchWorldAddress.mockReturnValue(worldAddressLookup.promise);
    mocks.fetch.mockReturnValue(configLookup.promise);

    const profilePromise = buildWorldProfile("mainnet", "mainnet-king-1");

    await flushMicrotasks(10);

    expect(mocks.fetchWorldAddress).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    worldAddressLookup.resolve("0x1");
    configLookup.resolve({
      ok: true,
      json: async () => [{ entry_token_address: "0x2", fee_token: "0x3" }],
    });

    await expect(profilePromise).resolves.toMatchObject({
      entryTokenAddress: "0x2",
      feeTokenAddress: "0x3",
      worldAddress: "0x1",
    });
  });

  it("falls back to the env rpc when deployment metadata is unavailable", async () => {
    mocks.resolveWorldContracts.mockResolvedValue({ spawn: "0xabc" });
    mocks.resolveWorldDeploymentFromFactory.mockResolvedValue(null);
    mocks.fetchWorldAddress.mockResolvedValue("0x1");
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ entry_token_address: "0x2", fee_token: "0x3" }],
    });

    await buildWorldProfile("mainnet", "s0-game-5");

    expect(mocks.normalizeRpcUrl).toHaveBeenCalledWith("https://fallback-rpc.example");
    expect(mocks.saveWorldProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "s0-game-5",
        rpcUrl: "https://fallback-rpc.example",
      }),
    );
  });

  it("prefers the deployment rpc metadata when the factory reports one", async () => {
    mocks.resolveWorldContracts.mockResolvedValue({ spawn: "0xabc" });
    mocks.resolveWorldDeploymentFromFactory.mockResolvedValue({
      worldAddress: "0xdef",
      rpcUrl: "https://per-world-rpc.example",
    });
    mocks.fetchWorldAddress.mockResolvedValue("0x1");
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ entry_token_address: "0x2", fee_token: "0x3" }],
    });

    await buildWorldProfile("mainnet", "s0-game-5");

    expect(mocks.normalizeRpcUrl).toHaveBeenCalledWith("https://per-world-rpc.example");
    expect(mocks.saveWorldProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "s0-game-5",
        rpcUrl: "https://per-world-rpc.example",
      }),
    );
  });

  it("saves a zero world address rather than throwing when nothing resolves it", async () => {
    mocks.resolveWorldContracts.mockResolvedValue({ spawn: "0xabc" });
    mocks.resolveWorldDeploymentFromFactory.mockResolvedValue(null);
    mocks.fetchWorldAddress.mockResolvedValue(null);
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => [],
    });

    await expect(buildWorldProfile("mainnet", "bltz-riff-363")).resolves.toMatchObject({
      worldAddress: "0x0",
    });

    expect(mocks.saveWorldProfile).toHaveBeenCalled();
  });
});
