import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../../../services/world-deployments", () => {
  const mockService = {
    getWorldDeployment: vi.fn(),
  };

  return {
    WorldDeploymentService: vi.fn().mockImplementation(() => mockService),
    worldDeploymentService: mockService,
  };
});

import worldDeploymentRoutes from "../world-deployments";
import { worldDeploymentService } from "../../../services/world-deployments";

describe("world deployment routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/api/world-deployments", worldDeploymentRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /:chain/:worldName returns cached deployment metadata", async () => {
    (worldDeploymentService.getWorldDeployment as ReturnType<typeof vi.fn>).mockResolvedValue({
      cacheStatus: "hit",
      chain: "mainnet",
      fetchedAt: 123,
      rpcUrl: "https://rpc.example",
      worldAddress: "0x1234",
      worldName: "bltz-warzone-31",
    });

    const response = await app.request("/api/world-deployments/mainnet/bltz-warzone-31");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Cache-Status")).toBe("hit");
    await expect(response.json()).resolves.toEqual({
      cacheStatus: "hit",
      chain: "mainnet",
      fetchedAt: 123,
      rpcUrl: "https://rpc.example",
      worldAddress: "0x1234",
      worldName: "bltz-warzone-31",
    });
  });

  it("returns 400 for an invalid chain", async () => {
    const response = await app.request("/api/world-deployments/not-a-chain/bltz-warzone-31");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid chain",
    });
  });

  it("returns 404 when no deployment metadata exists", async () => {
    (worldDeploymentService.getWorldDeployment as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const response = await app.request("/api/world-deployments/mainnet/missing-world");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "world deployment not found",
    });
  });

  it("returns 503 when the lookup fails", async () => {
    (worldDeploymentService.getWorldDeployment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("factory unavailable"),
    );

    const response = await app.request("/api/world-deployments/mainnet/bltz-warzone-31");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "deployment lookup unavailable",
    });
  });
});
