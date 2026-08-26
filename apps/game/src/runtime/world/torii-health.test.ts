// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { probeWorldToriiAlive } from "./torii-health";

const mockFetch = vi.fn<typeof globalThis.fetch>();

describe("probeWorldToriiAlive", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when SQL is reachable", async () => {
    mockFetch.mockResolvedValueOnce(new Response("[]", { status: 200 }));

    await expect(probeWorldToriiAlive("https://torii.realms.test")).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("https://torii.realms.test/sql", {
      method: "GET",
      signal: expect.any(AbortSignal),
    });
  });

  it("returns false when SQL reports a missing endpoint", async () => {
    mockFetch.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    await expect(probeWorldToriiAlive("https://torii.realms.test")).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to health when SQL is indeterminate", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await expect(probeWorldToriiAlive("https://torii.realms.test")).resolves.toBe(true);
  });

  it("does not classify an indeterminate probe as dead", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));

    await expect(probeWorldToriiAlive("https://torii.realms.test")).resolves.toBe(null);
  });
});
