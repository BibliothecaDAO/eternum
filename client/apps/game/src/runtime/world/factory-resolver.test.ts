// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildApiUrl: vi.fn(),
  fetchWithErrorHandling: vi.fn(),
}));

const mockFetch = vi.fn<typeof globalThis.fetch>();

vi.mock("@bibliothecadao/torii", () => ({
  FACTORY_QUERIES: {
    WORLD_CONTRACTS_BY_PADDED_NAME: (paddedName: string) =>
      `SELECT contract_address, contract_selector, name FROM [wf-WorldContract] WHERE name = "${paddedName}" LIMIT 1000;`,
    WORLD_DEPLOYED_BY_PADDED_NAME: (paddedName: string) =>
      `SELECT * FROM [wf-WorldDeployed] WHERE name = "${paddedName}" LIMIT 1;`,
  },
  buildApiUrl: mocks.buildApiUrl,
  fetchWithErrorHandling: mocks.fetchWithErrorHandling,
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_CHAIN: "mainnet",
    VITE_PUBLIC_REALTIME_URL: "https://realtime.example",
  },
}));

import { resolveWorldDeploymentFromFactory } from "./factory-resolver";

describe("resolveWorldDeploymentFromFactory", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mocks.buildApiUrl.mockReset();
    mocks.fetchWithErrorHandling.mockReset();
    mockFetch.mockReset();
    mocks.buildApiUrl.mockReturnValue("https://factory.example/sql?query=deployment");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers the realtime deployment endpoint when it returns deployment metadata", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cacheStatus: "hit",
          chain: "mainnet",
          fetchedAt: 123,
          rpcUrl: "https://rpc.example",
          worldAddress: "0x1234",
          worldName: "bltz-warzone-31",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await resolveWorldDeploymentFromFactory("mainnet", "https://factory.example/sql", "bltz-warzone-31");

    expect(result).toEqual({
      rpcUrl: "https://rpc.example",
      worldAddress: "0x1234",
    });
    expect(mockFetch).toHaveBeenCalledWith("https://realtime.example/api/world-deployments/mainnet/bltz-warzone-31", {
      signal: expect.any(AbortSignal),
    });
    expect(mocks.fetchWithErrorHandling).not.toHaveBeenCalled();
  });

  it("falls back to the legacy factory SQL lookup when the realtime endpoint fails", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "deployment lookup unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    mocks.fetchWithErrorHandling.mockResolvedValueOnce([
      {
        rpc_url: "https://rpc.example",
        world_address: "0x1234",
      },
    ]);

    const result = await resolveWorldDeploymentFromFactory("mainnet", "https://factory.example/sql", "bltz-warzone-31");

    expect(result).toEqual({
      rpcUrl: "https://rpc.example",
      worldAddress: "0x1234",
    });
    expect(mocks.fetchWithErrorHandling).toHaveBeenCalledTimes(1);
  });

  it("falls back to the legacy factory SQL lookup when the realtime endpoint returns no deployment", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "world deployment not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    mocks.fetchWithErrorHandling.mockResolvedValueOnce([
      {
        data: JSON.stringify({
          rpc_url: "https://rpc.example",
          world_address: "0x1234",
        }),
      },
    ]);

    const result = await resolveWorldDeploymentFromFactory("mainnet", "https://factory.example/sql", "bltz-warzone-31");

    expect(result).toEqual({
      rpcUrl: "https://rpc.example",
      worldAddress: "0x1234",
    });
    expect(mocks.fetchWithErrorHandling).toHaveBeenCalledTimes(1);
  });

  it("queries realtime deployment metadata with the selected world chain", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cacheStatus: "hit",
          chain: "slot",
          fetchedAt: 123,
          rpcUrl: "https://rpc.slot.example",
          worldAddress: "0xslot",
          worldName: "bltz-whiz-736",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await resolveWorldDeploymentFromFactory("slot", "https://factory.example/sql", "bltz-whiz-736");

    expect(result).toEqual({
      rpcUrl: "https://rpc.slot.example",
      worldAddress: "0xslot",
    });
    expect(mockFetch).toHaveBeenCalledWith("https://realtime.example/api/world-deployments/slot/bltz-whiz-736", {
      signal: expect.any(AbortSignal),
    });
    expect(mocks.fetchWithErrorHandling).not.toHaveBeenCalled();
  });
});
