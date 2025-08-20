/**
 * MatrixPool - Eliminates Matrix4.clone() memory waste
 */
import * as THREE from "three";

export class MatrixPool {
  private static instance: MatrixPool;
  private matrices: THREE.Matrix4[] = [];
  private inUse: Set<THREE.Matrix4> = new Set();

  private constructor() {
    // Pre-allocate pool
    for (let i = 0; i < 1000; i++) {
      this.matrices.push(new THREE.Matrix4());
    }
  }

  public static getInstance(): MatrixPool {
    if (!MatrixPool.instance) {
      MatrixPool.instance = new MatrixPool();
    }
    return MatrixPool.instance;
  }

  public getMatrix(): THREE.Matrix4 {
    const matrix = this.matrices.pop() || new THREE.Matrix4();
    this.inUse.add(matrix);
    return matrix;
  }

  public releaseMatrix(matrix: THREE.Matrix4): void {
    if (this.inUse.has(matrix)) {
      matrix.identity();
      this.inUse.delete(matrix);
      this.matrices.push(matrix);
    }
  }

  public releaseAll(matrices: THREE.Matrix4[]): void {
    matrices.forEach(matrix => this.releaseMatrix(matrix));
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
}