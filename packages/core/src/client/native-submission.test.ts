import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createNativeTicketSubmission } from "./native-submission";

// The transport uses the published Rust/Cairo intent vector, including its tag and version.
const vector = readFileSync(
  new URL("../../../../contracts/l3/randomness-protocol/tests/fixtures/v1.txt", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\s+/);
const intentLength = Number(BigInt(vector[1]));
const signed = { intent: vector.slice(2, 2 + intentLength), r: "0x3", s: "0x4" };
const action = vector[2 + intentLength];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("native ticket transport", () => {
  it("signs no envelope and follows the same accepted ticket until it has a transaction", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ action, order: 7 }))
      .mockResolvedValueOnce(json({ action, order: 7, transaction_hash: null }))
      .mockResolvedValueOnce(json({ action, order: 7, transaction_hash: "0x99" }));
    vi.stubGlobal("fetch", fetch);
    const pending = createNativeTicketSubmission("https://tickets.test/")(signed);
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toEqual({ transaction_hash: "0x99" });
    expect(fetch.mock.calls[0][0]).toBe("https://tickets.test/actions");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(signed);
    expect(fetch.mock.calls.slice(1).map(([url]) => url)).toEqual([
      `https://tickets.test/actions/${action}`,
      `https://tickets.test/actions/${action}`,
    ]);
    expect(fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  });

  it("retries admission backpressure with byte-identical intent and signature", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ action, order: 7 }))
      .mockResolvedValueOnce(json({ action, order: 7, transaction_hash: "0x99" }));
    vi.stubGlobal("fetch", fetch);
    const pending = createNativeTicketSubmission("https://tickets.test")(signed);
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toEqual({ transaction_hash: "0x99" });
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(fetch.mock.calls[0][1].signal).toBe(fetch.mock.calls[1][1].signal);
    expect(fetch.mock.calls[2][0]).toBe(`https://tickets.test/actions/${action}`);
  });

  it("does not follow an admission for a different action", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ action: "0x999", order: 7 }));
    vi.stubGlobal("fetch", fetch);
    await expect(createNativeTicketSubmission("https://tickets.test")(signed)).rejects.toThrow("different action");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects mismatched recovery status without admitting a replacement", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ action, order: 7 }))
      .mockResolvedValueOnce(json({ action, order: 8, transaction_hash: "0x99" }));
    vi.stubGlobal("fetch", fetch);
    await expect(createNativeTicketSubmission("https://tickets.test")(signed)).rejects.toThrow(
      "Do not submit a replacement",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not poll a refused intent", async () => {
    const fetch = vi.fn().mockResolvedValue(json({}, 400));
    vi.stubGlobal("fetch", fetch);
    await expect(createNativeTicketSubmission("https://tickets.test")(signed)).rejects.toThrow(
      "admission rejected (400)",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});
