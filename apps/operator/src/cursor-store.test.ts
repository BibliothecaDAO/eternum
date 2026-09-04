import { describe, expect, it, vi } from "vitest";
import { PostgresCursorStore } from "./cursor-store";

describe("operator cursor stream ownership", () => {
  it("holds a dedicated advisory-lock connection until close", async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes("pg_try_advisory_lock") ? { rows: [{ acquired: true }] } : { rows: [] },
    );
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
      end: vi.fn(async () => undefined),
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    const store = new PostgresCursorStore("postgres://unused", pool as never);

    await store.acquire("mainnet-registrations");
    expect(release).not.toHaveBeenCalled();
    await store.close();

    expect(query).toHaveBeenCalledWith(expect.stringContaining("pg_advisory_unlock"), [
      "eternum-operator:mainnet-registrations",
    ]);
    expect(release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("refuses to start when another operator owns the stream", async () => {
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [{ acquired: false }] })), release })),
      end: vi.fn(async () => undefined),
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    const store = new PostgresCursorStore("postgres://unused", pool as never);

    await expect(store.acquire("s2-results")).rejects.toThrow("Another operator owns stream s2-results");
    expect(release).toHaveBeenCalledOnce();
  });
});
