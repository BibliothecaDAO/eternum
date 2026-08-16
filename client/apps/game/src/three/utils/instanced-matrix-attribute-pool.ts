import { InstancedBufferAttribute } from "three";

const ELEMENTS_PER_MATRIX = 16;
const BYTES_PER_ELEMENT = 4;
const DEFAULT_CAPACITY = 256;
const GROWTH_STEP = 128;
// Hard budget on retained (idle) snapshot memory. Beyond it, released
// attributes are dropped for GC. The pool exists to damp allocation churn,
// not to retain every buffer ever created — unbounded, it grew by gigabytes
// of Float32Array backing stores while browsing the map (native memory the
// JS-heap metric barely surfaces).
const MAX_POOLED_BYTES = 64 * 1024 * 1024;
// A pooled buffer may serve a smaller request, but not one so small that
// most of the buffer is waste — that would bleed the budget on dead bytes.
const MAX_REUSE_OVERSHOOT_FACTOR = 2;

interface PooledAttribute {
  attribute: InstancedBufferAttribute;
  capacity: number;
}

export class InstancedMatrixAttributePool {
  private static instance: InstancedMatrixAttributePool;
  private availableByCapacity = new Map<number, PooledAttribute[]>();
  private inUse = new Set<InstancedBufferAttribute>();
  private pooledBytes = 0;

  static getInstance(): InstancedMatrixAttributePool {
    if (!InstancedMatrixAttributePool.instance) {
      InstancedMatrixAttributePool.instance = new InstancedMatrixAttributePool();
    }
    return InstancedMatrixAttributePool.instance;
  }

  acquire(requiredMatrices: number): InstancedBufferAttribute {
    const capacity = this.roundCapacity(Math.max(requiredMatrices, DEFAULT_CAPACITY));
    let pooled = this.takeReusable(capacity);

    if (!pooled) {
      const array = new Float32Array(capacity * ELEMENTS_PER_MATRIX);
      pooled = {
        capacity,
        attribute: new InstancedBufferAttribute(array, ELEMENTS_PER_MATRIX),
      };
    }

    this.inUse.add(pooled.attribute);
    return pooled.attribute;
  }

  release(attribute: InstancedBufferAttribute | undefined) {
    if (!attribute || !this.inUse.has(attribute)) {
      return;
    }

    this.inUse.delete(attribute);
    const capacity = attribute.array.length / ELEMENTS_PER_MATRIX;
    const bytes = capacity * ELEMENTS_PER_MATRIX * BYTES_PER_ELEMENT;

    // Over budget: drop the reference so GC frees the backing store.
    if (this.pooledBytes + bytes > MAX_POOLED_BYTES) {
      return;
    }

    const bucket = this.availableByCapacity.get(capacity) ?? [];
    bucket.push({ attribute, capacity });
    this.availableByCapacity.set(capacity, bucket);
    this.pooledBytes += bytes;
  }

  clear() {
    this.availableByCapacity.clear();
    this.inUse.clear();
    this.pooledBytes = 0;
  }

  /** Bytes currently held by idle pooled attributes (diagnostics). */
  getPooledBytes(): number {
    return this.pooledBytes;
  }

  /**
   * Pop the smallest idle attribute whose capacity covers the request without
   * excessive waste. Exact-capacity-only matching starved reuse (chunk
   * instance counts vary constantly), which is what let the pool grow.
   */
  private takeReusable(capacity: number): PooledAttribute | undefined {
    let bestCapacity = -1;
    for (const [pooledCapacity, bucket] of this.availableByCapacity) {
      if (bucket.length === 0) continue;
      if (pooledCapacity < capacity || pooledCapacity > capacity * MAX_REUSE_OVERSHOOT_FACTOR) continue;
      if (bestCapacity === -1 || pooledCapacity < bestCapacity) {
        bestCapacity = pooledCapacity;
      }
    }

    if (bestCapacity === -1) {
      return undefined;
    }

    const bucket = this.availableByCapacity.get(bestCapacity)!;
    const pooled = bucket.pop()!;
    if (bucket.length === 0) {
      this.availableByCapacity.delete(bestCapacity);
    }
    this.pooledBytes -= bestCapacity * ELEMENTS_PER_MATRIX * BYTES_PER_ELEMENT;
    return pooled;
  }

  private roundCapacity(required: number): number {
    if (required <= DEFAULT_CAPACITY) {
      return DEFAULT_CAPACITY;
    }

    const steps = Math.ceil((required - DEFAULT_CAPACITY) / GROWTH_STEP);
    return DEFAULT_CAPACITY + steps * GROWTH_STEP;
  }
}
