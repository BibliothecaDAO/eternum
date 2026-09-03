import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../../../env", () => ({
  env: {
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

    expect(resolveFactoryEndpoint()).toEqual({
      baseUrl: "https://launch.test",
      credentials: "include",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://launch.test/api/factory/runs",
      expect.objectContaining({ credentials: "include", method: "POST" }),
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
