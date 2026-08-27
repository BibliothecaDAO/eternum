// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isToriiAvailable } from "./torii-health";

const mockFetch = vi.fn<typeof globalThis.fetch>();

describe("isToriiAvailable", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports whether the landing-page SQL read model is reachable", async () => {
    mockFetch.mockResolvedValueOnce(new Response("[]", { status: 200 }));

    await expect(isToriiAvailable("https://torii.realms.test")).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("https://torii.realms.test/sql", {
      method: "HEAD",
    });
  });

  it("reports an unreachable landing-page read model without retrying", async () => {
    mockFetch.mockRejectedValueOnce(new Error("unreachable"));

    await expect(isToriiAvailable("https://torii.realms.test")).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
