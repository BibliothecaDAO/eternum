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
  private available: PooledAttribute[] = [];
  private inUse = new Set<InstancedBufferAttribute>();

  static getInstance(): InstancedMatrixAttributePool {
    if (!InstancedMatrixAttributePool.instance) {
      InstancedMatrixAttributePool.instance = new InstancedMatrixAttributePool();
    }
    return InstancedMatrixAttributePool.instance;
  }

  acquire(requiredMatrices: number): InstancedBufferAttribute {
    const requiredCapacity = Math.max(requiredMatrices, DEFAULT_CAPACITY);
    const matchIndex = this.available.findIndex((entry) => entry.capacity >= requiredCapacity);
    let pooled: PooledAttribute | undefined;

    if (matchIndex !== -1) {
      pooled = this.available.splice(matchIndex, 1)[0];
    } else {
      const capacity = this.roundCapacity(requiredCapacity);
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
    this.available.push({ attribute, capacity });
  }

  clear() {
    this.available.length = 0;
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
