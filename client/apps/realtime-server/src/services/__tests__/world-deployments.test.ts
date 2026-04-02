import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorldDeploymentService } from "../world-deployments";

const mockFetch = vi.fn<typeof globalThis.fetch>();

const createDeploymentRow = (overrides?: Record<string, unknown>) => ({
  world_address: "0x1234",
  rpc_url: "https://rpc.example",
  ...overrides,
});

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("WorldDeploymentService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.restoreAllMocks();
  });

  it("fetches deployment metadata from the factory and normalizes the response", async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse([createDeploymentRow()]));

    const service = new WorldDeploymentService({
      staleMs: 5_000,
      timeoutMs: 2_000,
      ttlMs: 1_000,
    });

    const result = await service.getWorldDeployment("mainnet", "bltz-warzone-31");

    expect(result).toEqual({
      cacheStatus: "miss",
      chain: "mainnet",
      fetchedAt: expect.any(Number),
      rpcUrl: "https://rpc.example",
      worldAddress: "0x1234",
      worldName: "bltz-warzone-31",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain("/x/eternum-factory-mainnet/torii/sql?query=");
    expect(String(url)).toContain("wf-WorldDeployed");
    expect(String(url)).toContain("LIMIT%201");
    expect((init as RequestInit).signal).toBeDefined();
  });

  it("serves a fresh cache hit without refetching", async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse([createDeploymentRow()]));

    const service = new WorldDeploymentService({
      staleMs: 5_000,
      timeoutMs: 2_000,
      ttlMs: 60_000,
    });

    const first = await service.getWorldDeployment("mainnet", "bltz-warzone-31");
    const second = await service.getWorldDeployment("mainnet", "bltz-warzone-31");

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("hit");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns stale cached deployment when refresh fails after ttl expiry", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValueOnce(createJsonResponse([createDeploymentRow()]));
    mockFetch.mockRejectedValueOnce(new Error("factory down"));

    const service = new WorldDeploymentService({
      staleMs: 120_000,
      timeoutMs: 2_000,
      ttlMs: 1_000,
    });

    await service.getWorldDeployment("mainnet", "bltz-warzone-31");
    await vi.advanceTimersByTimeAsync(1_100);

    const result = await service.getWorldDeployment("mainnet", "bltz-warzone-31");

    expect(result.cacheStatus).toBe("stale");
    expect(result.worldAddress).toBe("0x1234");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("deduplicates concurrent requests for the same world", async () => {
    const pendingFetch = deferred<Response>();
    mockFetch.mockReturnValue(pendingFetch.promise);

    const service = new WorldDeploymentService({
      staleMs: 5_000,
      timeoutMs: 2_000,
      ttlMs: 1_000,
    });

    const firstRequest = service.getWorldDeployment("mainnet", "bltz-warzone-31");
    const secondRequest = service.getWorldDeployment("mainnet", "bltz-warzone-31");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    pendingFetch.resolve(createJsonResponse([createDeploymentRow()]));

    await expect(firstRequest).resolves.toMatchObject({ worldAddress: "0x1234" });
    await expect(secondRequest).resolves.toMatchObject({ worldAddress: "0x1234" });
  });

  it("returns null when the deployment row is not found", async () => {
    mockFetch.mockResolvedValueOnce(createJsonResponse([]));

    const service = new WorldDeploymentService({
      staleMs: 5_000,
      timeoutMs: 2_000,
      ttlMs: 1_000,
    });

    const result = await service.getWorldDeployment("mainnet", "missing-world");

    expect(result).toBeNull();
  });
});
