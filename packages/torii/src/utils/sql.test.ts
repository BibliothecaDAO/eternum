import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJsonWithErrorHandling, fetchWithErrorHandling } from "./sql";

const jsonResponse = (body: unknown, status = 200, statusText = "OK") =>
  new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });

describe("SQL fetch helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries transient HTTP failures before returning SQL rows", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503, "Service Unavailable"))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithErrorHandling<{ id: number }>("https://torii.test/sql", "Failed to fetch rows", {
        retryDelaysMs: [0],
      }),
    ).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient HTTP failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "bad request" }, 400, "Bad Request"))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithErrorHandling<{ id: number }>("https://torii.test/sql", "Failed to fetch rows", {
        retryDelaysMs: [0],
      }),
    ).rejects.toThrow("Failed to fetch rows: Bad Request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds stalled JSON fetches with a timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const request = fetchJsonWithErrorHandling("https://torii.test/cache", "Failed to fetch cache", {
      retryDelaysMs: [],
      timeoutMs: 25,
    });
    const expectation = expect(request).rejects.toThrow("Failed to fetch cache: Request timed out after 25ms");

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
