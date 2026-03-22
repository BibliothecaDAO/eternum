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
});
