import { describe, expect, it } from "vitest";

import { InstancedMatrixAttributePool } from "./instanced-matrix-attribute-pool";

describe("InstancedMatrixAttributePool", () => {
  it("reuses attributes from the same rounded capacity bucket", () => {
    const pool = InstancedMatrixAttributePool.getInstance();
    pool.clear();

    const first = pool.acquire(300);
    pool.release(first);

    const second = pool.acquire(260);

    expect(second).toBe(first);

    pool.release(second);
    pool.clear();
  });

  it("reuses a larger pooled attribute for a smaller request within the overshoot bound", () => {
    const pool = InstancedMatrixAttributePool.getInstance();
    pool.clear();

    const large = pool.acquire(300); // rounds to 384
    pool.release(large);

    // 140 rounds to 256; 384 <= 256 * 2, so the idle 384 must be reused
    // instead of allocating a fresh backing store.
    const reused = pool.acquire(140);
    expect(reused).toBe(large);

    pool.release(reused);
    pool.clear();
  });

  it("does not hand out a wastefully oversized pooled attribute", () => {
    const pool = InstancedMatrixAttributePool.getInstance();
    pool.clear();

    const huge = pool.acquire(5000);
    pool.release(huge);

    const small = pool.acquire(200); // rounds to 256; huge exceeds 2x overshoot
    expect(small).not.toBe(huge);

    pool.release(small);
    pool.clear();
  });

  it("drops released attributes once the pooled-byte budget is full", () => {
    const pool = InstancedMatrixAttributePool.getInstance();
    pool.clear();

    // One attribute of exactly the 64 MiB budget: 64 MiB / (16 floats * 4B) matrices.
    const budgetMatrices = (64 * 1024 * 1024) / (16 * 4);
    const filler = pool.acquire(budgetMatrices);
    pool.release(filler);
    expect(pool.getPooledBytes()).toBe(64 * 1024 * 1024);

    // The budget is full — this release must be dropped, not retained.
    const overflow = pool.acquire(200);
    pool.release(overflow);
    expect(pool.getPooledBytes()).toBe(64 * 1024 * 1024);

    // A new request that the filler is too big to serve gets a fresh
    // attribute — never the dropped one.
    const fresh = pool.acquire(200);
    expect(fresh).not.toBe(overflow);
    expect(fresh).not.toBe(filler);

    pool.release(fresh);
    pool.clear();
  });
});
