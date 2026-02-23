/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  isDynamicImportChunkError,
  shouldAttemptDynamicImportRecovery,
} from "./error-boundary.dynamic-import-recovery";

const createStorage = (initialValue?: string) => {
  const store = new Map<string, string>();
  if (initialValue !== undefined) {
    store.set("eternum:last-dynamic-import-reload", initialValue);
  }

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as Pick<Storage, "getItem" | "setItem">;
};

describe("error-boundary dynamic import recovery", () => {
  it("detects dynamic import fetch failures", () => {
    expect(
      isDynamicImportChunkError(new TypeError("Failed to fetch dynamically imported module: /assets/chunk.js")),
    ).toBe(true);
  });

  it("detects webpack-style chunk load errors", () => {
    const error = new Error("Loading chunk 42 failed.");
    error.name = "ChunkLoadError";
    expect(isDynamicImportChunkError(error)).toBe(true);
  });

  it("does not flag unrelated runtime errors", () => {
    expect(isDynamicImportChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("throttles repeated recovery attempts within the cooldown window", () => {
    const storage = createStorage();
    const now = 1_000_000;

    expect(shouldAttemptDynamicImportRecovery(storage, now)).toBe(true);
    expect(shouldAttemptDynamicImportRecovery(storage, now + 10_000)).toBe(false);
    expect(shouldAttemptDynamicImportRecovery(storage, now + 31_000)).toBe(true);
  });

  it("recovers from malformed storage values", () => {
    const storage = createStorage("not-a-number");
    expect(shouldAttemptDynamicImportRecovery(storage, 2_000_000)).toBe(true);
  });

  it("does not auto-recover when storage is unavailable", () => {
    expect(shouldAttemptDynamicImportRecovery(null, 2_000_000)).toBe(false);
  });

  it("does not auto-recover when storage writes fail", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("write failed");
      },
    } as Pick<Storage, "getItem" | "setItem">;

    expect(shouldAttemptDynamicImportRecovery(storage, 3_000_000)).toBe(false);
  });
});
