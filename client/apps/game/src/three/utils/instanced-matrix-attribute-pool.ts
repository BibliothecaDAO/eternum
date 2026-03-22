import { InstancedBufferAttribute } from "three";

const ELEMENTS_PER_MATRIX = 16;
const DEFAULT_CAPACITY = 256;
const GROWTH_STEP = 128;

interface PooledAttribute {
  attribute: InstancedBufferAttribute;
  capacity: number;
}

export class InstancedMatrixAttributePool {
  private static instance: InstancedMatrixAttributePool;
  private availableByCapacity = new Map<number, PooledAttribute[]>();
  private inUse = new Set<InstancedBufferAttribute>();

  static getInstance(): InstancedMatrixAttributePool {
    if (!InstancedMatrixAttributePool.instance) {
      InstancedMatrixAttributePool.instance = new InstancedMatrixAttributePool();
    }
    return InstancedMatrixAttributePool.instance;
  }

  acquire(requiredMatrices: number): InstancedBufferAttribute {
    const capacity = this.roundCapacity(Math.max(requiredMatrices, DEFAULT_CAPACITY));
    const bucket = this.availableByCapacity.get(capacity);
    let pooled = bucket?.pop();

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
    const bucket = this.availableByCapacity.get(capacity) ?? [];
    bucket.push({ attribute, capacity });
    this.availableByCapacity.set(capacity, bucket);
  }

  clear() {
    this.availableByCapacity.clear();
    this.inUse.clear();
  }

  private roundCapacity(required: number): number {
    if (required <= DEFAULT_CAPACITY) {
      return DEFAULT_CAPACITY;
    }

    const steps = Math.ceil((required - DEFAULT_CAPACITY) / GROWTH_STEP);
    return DEFAULT_CAPACITY + steps * GROWTH_STEP;
  }
}
