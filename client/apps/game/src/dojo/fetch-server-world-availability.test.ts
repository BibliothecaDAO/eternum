import { describe, expect, it, vi } from "vitest";
import { fetchServerWorldAvailability } from "./fetch-server-world-availability";

const jsonResponse = (body: unknown, ok = true): Response =>
  ({ ok, json: async () => body }) as unknown as Response;

describe("fetchServerWorldAvailability", () => {
  it("returns 'unknown' without a base url or world name", async () => {
    const fetchFn = vi.fn();
    await expect(fetchServerWorldAvailability("", "world", { fetchFn })).resolves.toBe("unknown");
    await expect(fetchServerWorldAvailability("https://rt", "", { fetchFn })).resolves.toBe("unknown");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns 'alive' when the matching world is alive", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse([
        { name: "other", alive: false },
        { name: "eternum-1", alive: true },
      ]),
    );
    await expect(fetchServerWorldAvailability("https://rt/", "eternum-1", { fetchFn })).resolves.toBe("alive");
    expect(fetchFn).toHaveBeenCalledWith("https://rt/api/worlds/summary", expect.objectContaining({ method: "GET" }));
  });

  it("returns 'dead' when the matching world is not alive", async () => {
    const fetchFn = vi.fn(async () => jsonResponse([{ name: "eternum-1", alive: false }]));
    await expect(fetchServerWorldAvailability("https://rt", "eternum-1", { fetchFn })).resolves.toBe("dead");
  });

  it("returns 'unknown' when the world is not in the summary", async () => {
    const fetchFn = vi.fn(async () => jsonResponse([{ name: "other", alive: true }]));
    await expect(fetchServerWorldAvailability("https://rt", "eternum-1", { fetchFn })).resolves.toBe("unknown");
  });

  it("returns 'unknown' on non-ok response, non-array payload, or fetch throw", async () => {
    await expect(
      fetchServerWorldAvailability("https://rt", "w", { fetchFn: vi.fn(async () => jsonResponse([], false)) }),
    ).resolves.toBe("unknown");
    await expect(
      fetchServerWorldAvailability("https://rt", "w", { fetchFn: vi.fn(async () => jsonResponse({ nope: true })) }),
    ).resolves.toBe("unknown");
    await expect(
      fetchServerWorldAvailability("https://rt", "w", {
        fetchFn: vi.fn(async () => {
          throw new Error("network down");
        }),
      }),
    ).resolves.toBe("unknown");
  });
});
