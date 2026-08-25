/**
 * MatrixPool - Eliminates Matrix4.clone() memory waste
 */
import { Matrix4 } from "three";

const DEFAULT_POOL_SIZE = 4096;
const GROWTH_STEP = 512;

export class MatrixPool {
  private static instance: MatrixPool;
  private matrices: Matrix4[] = [];
  private inUse: Set<Matrix4> = new Set();

  private constructor(initialSize: number = DEFAULT_POOL_SIZE) {
    this.expandPool(initialSize);
  }

  public static getInstance(): MatrixPool {
    if (!MatrixPool.instance) {
      MatrixPool.instance = new MatrixPool();
    }
    return MatrixPool.instance;
  }

  public getMatrix(): Matrix4 {
    if (this.matrices.length === 0) {
      this.expandPool(GROWTH_STEP);
    }

    const matrix = this.matrices.pop() || new Matrix4();
    this.inUse.add(matrix);
    return matrix;
  }

  public releaseMatrix(matrix: Matrix4): void {
    if (this.inUse.has(matrix)) {
      matrix.identity();
      this.inUse.delete(matrix);
      this.matrices.push(matrix);
    }
  }

  public releaseAll(matrices: Matrix4[]): void {
    matrices.forEach((matrix) => this.releaseMatrix(matrix));
  }

  public ensureCapacity(requiredTotal: number): void {
    const totalAllocated = this.matrices.length + this.inUse.size;
    if (totalAllocated >= requiredTotal) {
      return;
    }

    const deficit = requiredTotal - totalAllocated;
    const chunks = Math.ceil(deficit / GROWTH_STEP);
    this.expandPool(chunks * GROWTH_STEP);
  }

  /**
   * Get pool statistics for monitoring
   */
  public getStats() {
    const totalAllocated = this.matrices.length + this.inUse.size;
    return {
      available: this.matrices.length,
      inUse: this.inUse.size,
      totalAllocated,
      memoryEstimateMB: (totalAllocated * 80) / (1024 * 1024), // ~80 bytes per Matrix4
    };
  }

  /**
   * Clear the entire pool (for cleanup)
   */
  public clear(): void {
    this.matrices = [];
    this.inUse.clear();
  }

  private expandPool(count: number) {
    for (let i = 0; i < count; i++) {
      this.matrices.push(new Matrix4());
    }
  }
}
