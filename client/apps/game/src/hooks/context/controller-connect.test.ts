import { describe, expect, it, vi } from "vitest";

import { connectWithControllerRetry, pickPrimaryConnector, warmControllerConnector } from "./controller-connect";

describe("controller-connect", () => {
  it("prefers the controller connector when available", () => {
    const connectors = [{ id: "braavos" }, { id: "controller" }, { id: "argent" }] as any[];
    const picked = pickPrimaryConnector(connectors as any);
    expect(picked?.id).toBe("controller");
  });

  it("warms controller connector only when not ready", async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const connector = {
      id: "controller",
      isReady: vi.fn().mockReturnValue(false),
      controller: { probe },
    } as any;

    await warmControllerConnector(connector);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("retries once after a not-ready connect error", async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const connector = {
      id: "controller",
      isReady: vi.fn().mockReturnValue(false),
      controller: { probe },
    } as any;

    const connectAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error("Not ready to connect"))
      .mockResolvedValueOnce(undefined);

    await connectWithControllerRetry(connectAsync, connector);

    expect(probe).toHaveBeenCalledTimes(2);
    expect(connectAsync).toHaveBeenCalledTimes(2);
  });

  it("does not retry for non-readiness errors", async () => {
    const connector = {
      id: "controller",
      isReady: vi.fn().mockReturnValue(true),
      controller: { probe: vi.fn() },
    } as any;

    const connectAsync = vi.fn().mockRejectedValueOnce(new Error("user rejected"));

    await expect(connectWithControllerRetry(connectAsync, connector)).rejects.toThrow("user rejected");
    expect(connectAsync).toHaveBeenCalledTimes(1);
  });
});
