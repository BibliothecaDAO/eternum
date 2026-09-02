import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../../../env", () => ({
  env: {
    VITE_PUBLIC_FACTORY_WORKER_URL: "https://worker.test/",
    VITE_PUBLIC_LAUNCH_SERVICE_URL: "https://launch.test/",
  },
}));

import { createFactoryRun, deleteFactoryRun, resolveFactoryEndpoint } from "./factory-worker";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("factory launch endpoint routing", () => {
  test("routes madara through the authenticated box service", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    await createFactoryRun({
      environment: "madara.blitz",
      gameName: "bltz-box-route",
      gameStartTime: "2026-09-01T17:00:00.000Z",
    });

    expect(resolveFactoryEndpoint("madara.blitz")).toEqual({
      baseUrl: "https://launch.test",
      credentials: "include",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://launch.test/api/factory/runs",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  test("keeps appchain on the existing serverless worker", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    await createFactoryRun({
      environment: "appchain.blitz",
      gameName: "bltz-worker-route",
      gameStartTime: "2026-09-01T17:00:00.000Z",
    });

    expect(resolveFactoryEndpoint("appchain.blitz")).toEqual({
      baseUrl: "https://worker.test",
      credentials: "omit",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://worker.test/api/factory/runs",
      expect.objectContaining({ credentials: "omit", method: "POST" }),
    );
  });

  test("uses session authorization instead of the serverless admin header on Madara", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await deleteFactoryRun({ environment: "madara.blitz", gameName: "bltz-box-route", adminSecret: "legacy" });

    const headers = fetch.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has("x-factory-admin-secret")).toBe(false);
  });
});
