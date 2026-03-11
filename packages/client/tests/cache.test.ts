import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ViewCache } from "../src/cache";

describe("ViewCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return null for missing keys", () => {
    const cache = new ViewCache(5000);
    expect(cache.get("missing")).toBeNull();
  });

  it("should store and retrieve values", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", { data: "hello" });
    expect(cache.get("key1")).toEqual({ data: "hello" });
  });

  it("should expire entries after TTL", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", { data: "hello" });

    expect(cache.get("key1")).toEqual({ data: "hello" });

    vi.advanceTimersByTime(5001);

    expect(cache.get("key1")).toBeNull();
  });

  it("should not expire entries before TTL", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", { data: "hello" });

    vi.advanceTimersByTime(4999);

    expect(cache.get("key1")).toEqual({ data: "hello" });
  });

  it("should invalidate a specific key", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", "a");
    cache.set("key2", "b");

    cache.invalidate("key1");

    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBe("b");
  });

  it("should invalidate all keys", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", "a");
    cache.set("key2", "b");

    cache.invalidateAll();

    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("should invalidate by prefix pattern", () => {
    const cache = new ViewCache(5000);
    cache.set("realm:1", "a");
    cache.set("realm:2", "b");
    cache.set("market", "c");

    cache.invalidateByPrefix("realm:");

    expect(cache.get("realm:1")).toBeNull();
    expect(cache.get("realm:2")).toBeNull();
    expect(cache.get("market")).toBe("c");
  });

  it("should report correct size", () => {
    const cache = new ViewCache(5000);
    expect(cache.size).toBe(0);

    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);

    cache.invalidate("a");
    expect(cache.size).toBe(1);
  });

  it("should overwrite existing values", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", "old");
    cache.set("key1", "new");
    expect(cache.get("key1")).toBe("new");
  });

  it("should reset TTL on overwrite", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", "old");

    vi.advanceTimersByTime(4000);
    cache.set("key1", "new");

    vi.advanceTimersByTime(4000);
    expect(cache.get("key1")).toBe("new");

    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeNull();
  });

  it("should clean up expired entries on get", () => {
    const cache = new ViewCache(5000);
    cache.set("key1", "a");

    vi.advanceTimersByTime(5001);

    // Size still shows 1 until we access it
    cache.get("key1"); // triggers cleanup
    expect(cache.size).toBe(0);
  });

  it("should use default TTL of 5000ms", () => {
    const cache = new ViewCache();
    cache.set("key1", "a");

    vi.advanceTimersByTime(4999);
    expect(cache.get("key1")).toBe("a");

    vi.advanceTimersByTime(2);
    expect(cache.get("key1")).toBeNull();
  });

  it("should evict least recently used entry when max size is reached", () => {
    const cache = new ViewCache(5000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("should refresh recency when a key is accessed", () => {
    const cache = new ViewCache(5000, 2);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBe(1);

    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBe(3);
  });

  it("should coerce invalid max size to 1", () => {
    const cache = new ViewCache(5000, 0);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(1);
  });
});
